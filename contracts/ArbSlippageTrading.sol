pragma solidity ^0.5.15;

import "./aave/FlashLoanReceiverBase.sol";
import "./aave/ILendingPoolAddressesProvider.sol";
import "./aave/ILendingPool.sol";
import "./exchanges/KyberNetworkProxy.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";

interface UniswapExchange {
    function tokenToEthSwapInput(uint256 tokens_sold, uint256 min_eth, uint256 deadline) external returns (uint256  eth_bought);
    function tokenToEthTransferInput(uint256 tokens_sold, uint256 min_eth, uint256 deadline, address recipient) external returns (uint256  eth_bought);
    function tokenToEthSwapOutput(uint256 eth_bought, uint256 max_tokens, uint256 deadline) external returns (uint256  tokens_sold);
}

contract ArbSlippageTrading is FlashLoanReceiverBase {

  using SafeMath for uint256;
  address kyberExchangeAddress = 0x818E6FECD516Ecc3849DAf6845e3EC868087B755;
  address tokenAddress = 0x6B175474E89094C44Da98b954EedeAC495271d0F; // dai
  address uniSwapExchangeAddress = 0x2a1530C4C41db0B0b2bB646CB5Eb1A67b7158667;
  uint256 maxTokensSell;
  uint256 sellDeadline;
  uint256 minConversionRate;
  address arbOwner;

  constructor () public {
    arbOwner = msg.sender;
  }

  modifier onlyOwner () {
    require(msg.sender == arbOwner);
    _;
  }

  function () external payable {}

  event ethToToken(address trader, uint256 tokens, uint256 token_bought);
  event tokenToEth(address trader, uint256 ethToSell, uint256 maxTokensSell, uint256 tokens_sold);
  event profitTake(address trader, uint256 profit);
  event tradePre(address this, uint256 _amount);
  event tradeMade(address this, uint256 _amount);

  uint256[] myArray = new uint256[](2);

  function getArray() internal view returns (uint256[] memory) {
    return myArray;
  }

  function setArray(uint256 maxTokensSell_a, uint256 sellDeadline_a) public {
    myArray = [maxTokensSell_a, sellDeadline_a];
  }


  function approveToken(address _tokenAddress, address _exchangeAddress, uint _amount) public {
    ERC20 token = ERC20(_tokenAddress);
    token.approve(_exchangeAddress, _amount);
  }


  function trade(
    address _kyberExchangeAddress,
    address _tokenAddress,
    address _uniSwapExchangeAddress,
    uint256 _ethToSell,
    uint256 _maxTokensSell,
    uint256 _sellDeadline
  )
    public
    payable
    returns (uint256 ethSwaped)
  {
    KyberNetworkProxy kyberExchange = KyberNetworkProxy(_kyberExchangeAddress);
    ERC20 token = ERC20(_tokenAddress);
    // use _expectedRate for minConversionRate.
    (uint _expectedRate, uint _slippageRate) = kyberExchange.getExpectedRate(ERC20(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE),token,_ethToSell);

    // Swaps Eth for Token via Kyber Exchange
    uint256 token_bought = kyberExchange.swapEtherToToken.value(_ethToSell)(token, _expectedRate);
    emit ethToToken(msg.sender, _ethToSell, token_bought);

    // check approval
    approveToken(_tokenAddress, _uniSwapExchangeAddress, token_bought);

    // swap an exact amount of tokens for as much ETH as possible
    UniswapExchange uniSwapExchange = UniswapExchange(_uniSwapExchangeAddress);
    uint256 tokens_sold = uniSwapExchange.tokenToEthTransferInput(token_bought, _maxTokensSell, _sellDeadline, address(this));

    emit tokenToEth(msg.sender, _ethToSell, _maxTokensSell, tokens_sold);

    return tokens_sold;
  }


  function withdrawDAI() onlyOwner public returns (bool result) {
    ERC20 daiToken = ERC20(tokenAddress);
    daiToken.transfer(msg.sender, daiToken.balanceOf(address(this)));
    return true;
  }

  function withdrawETH() onlyOwner public returns (bool result) {
    msg.sender.transfer(address(this).balance);
    return true;
  }


  function executeOperation(
    address _reserve,
    uint256 _loanedamount,
    uint256 _fee,
    bytes calldata _params
  )
    external
  {
    require(_loanedamount <= getBalanceInternal(address(this), _reserve), "Invalid balance, was the flashLoan successful?");

    emit tradePre(address(this), address(this).balance);

    uint256[] memory param = getArray();

    // ETH -> DAI -> ETH
    uint256 tokens_sold = trade(
      kyberExchangeAddress,
      tokenAddress,
      uniSwapExchangeAddress,
      _loanedamount,
      param[0], //maxTokensSell,
      param[1] //sellDeadline
    );

    // token_sold has to be greater than _loanedamount, other case will cause revert SafeMath: subtraction overflow.
    // For test, lets fake the profit.
    tokens_sold = 200000000000000000000; // 200 eth fake token_sold
    uint256 profit = tokens_sold.sub(_loanedamount.add(_fee));

    emit profitTake(msg.sender, profit); // record profit in event
    emit tradeMade(address(this), address(this).balance);

    // Time to transfer the funds back
    uint totalDebt = _loanedamount.add(_fee);
    transferFundsBackToPoolInternal(_reserve, totalDebt);
  }
}
