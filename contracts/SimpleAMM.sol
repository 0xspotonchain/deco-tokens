// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

// SimpleAMM — a minimal constant-product AMM (x * y = k) with a 0.3% fee,
// one pool per deployment, built for deco's testnet volume-sniper stack.
//
// One side is always DECO (ERC-20). The other side ("base") is either the
// chain's NATIVE token (quote == address(0): ETH on Robinhood, zkLTC on
// LitVM) or an ERC-20 quote token (USDC view on Arc).
//
// There is deliberately NO remove-liquidity function: once seeded, the
// liquidity stays locked in the pool, like 0xzunid's pools. The seeder is
// the only liquidity provider, so no LP tokens are minted — reserves are
// just tracked in storage.
//
// TESTNET ONLY. Do not deploy to mainnet.
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SimpleAMM is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable deco;
    // address(0) => base asset is the chain's native token; otherwise an ERC-20.
    IERC20 public immutable quote;

    uint256 public decoReserve;
    uint256 public baseReserve;

    event LiquidityAdded(address indexed provider, uint256 decoAmount, uint256 baseAmount);
    event Swap(address indexed trader, bool isBuy, uint256 amountIn, uint256 amountOut);

    constructor(address _deco, address _quote) {
        require(_deco != address(0), "SimpleAMM: DECO address is zero");
        deco = IERC20(_deco);
        quote = IERC20(_quote); // address(0) is a valid sentinel: native base
    }

    /// @notice Constant-product output with a 0.3% fee (997/1000).
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256) {
        require(amountIn > 0, "SimpleAMM: zero input");
        require(reserveIn > 0 && reserveOut > 0, "SimpleAMM: empty pool");
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        return numerator / denominator;
    }

    function getReserves() external view returns (uint256 decoReserve_, uint256 baseReserve_) {
        return (decoReserve, baseReserve);
    }

    /// @notice Seed (or top up) the pool. Caller must approve DECO first,
    /// and approve the quote ERC-20 first when the base is not native.
    /// Native base: msg.value must equal baseAmount exactly.
    function addLiquidity(uint256 decoAmount, uint256 baseAmount) external payable nonReentrant {
        require(decoAmount > 0 && baseAmount > 0, "SimpleAMM: zero amount");
        deco.safeTransferFrom(msg.sender, address(this), decoAmount);
        if (address(quote) == address(0)) {
            require(msg.value == baseAmount, "SimpleAMM: msg.value != baseAmount");
        } else {
            require(msg.value == 0, "SimpleAMM: no native value for ERC-20 base");
            quote.safeTransferFrom(msg.sender, address(this), baseAmount);
        }
        decoReserve += decoAmount;
        baseReserve += baseAmount;
        emit LiquidityAdded(msg.sender, decoAmount, baseAmount);
    }

    /// @notice Spend base, receive DECO.
    /// Native base: msg.value must equal baseAmountIn exactly.
    /// ERC-20 base: caller must approve the quote token first.
    function buy(uint256 baseAmountIn, uint256 minDecoOut) external payable nonReentrant {
        uint256 decoOut = getAmountOut(baseAmountIn, baseReserve, decoReserve);
        require(decoOut >= minDecoOut, "SimpleAMM: slippage");
        if (address(quote) == address(0)) {
            require(msg.value == baseAmountIn, "SimpleAMM: msg.value != baseAmountIn");
        } else {
            require(msg.value == 0, "SimpleAMM: no native value for ERC-20 base");
            quote.safeTransferFrom(msg.sender, address(this), baseAmountIn);
        }
        deco.safeTransfer(msg.sender, decoOut);
        baseReserve += baseAmountIn;
        decoReserve -= decoOut;
        emit Swap(msg.sender, true, baseAmountIn, decoOut);
    }

    /// @notice Spend DECO, receive base. Caller must approve DECO first.
    function sell(uint256 decoAmountIn, uint256 minBaseOut) external nonReentrant {
        uint256 baseOut = getAmountOut(decoAmountIn, decoReserve, baseReserve);
        require(baseOut >= minBaseOut, "SimpleAMM: slippage");
        deco.safeTransferFrom(msg.sender, address(this), decoAmountIn);
        if (address(quote) == address(0)) {
            (bool ok, ) = payable(msg.sender).call{value: baseOut}("");
            require(ok, "SimpleAMM: native transfer failed");
        } else {
            quote.safeTransfer(msg.sender, baseOut);
        }
        decoReserve += decoAmountIn;
        baseReserve -= baseOut;
        emit Swap(msg.sender, false, decoAmountIn, baseOut);
    }

    /// @notice Reject stray native transfers: native only enters via
    /// addLiquidity / buy, so the reserves always match the real balances.
    receive() external payable {
        revert("SimpleAMM: use addLiquidity or buy");
    }
}
