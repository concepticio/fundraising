const { assertRevert } = require('@aragon/test-helpers/assertThrow')
const { hash } = require('eth-ens-namehash')
const assertEvent = require('@aragon/test-helpers/assertEvent')
const getBalance = require('@aragon/test-helpers/balance')(web3)
const web3Call = require('@aragon/test-helpers/call')(web3)
const ethABI = new (require('web3-eth-abi')).AbiCoder()
const getEvent = (receipt, event, arg) => {
  return receipt.logs.filter(l => l.event == event)[0].args[arg]
}
const encodeFunctionCall = (contract, functionName, ...params) =>
  contract[functionName].request(...params).params[0]

const ACL = artifacts.require('ACL')
const AppProxyUpgradeable = artifacts.require('AppProxyUpgradeable')
const EVMScriptRegistryFactory = artifacts.require('EVMScriptRegistryFactory')
const DAOFactory = artifacts.require('DAOFactory')
const Kernel = artifacts.require('Kernel')
const Pool = artifacts.require('Pool')

const EtherTokenConstantMock = artifacts.require('EtherTokenConstantMock')
const TokenMock = artifacts.require('TokenMock')
const DestinationMock = artifacts.require('DestinationMock')
const ExecutionTarget = artifacts.require('ExecutionTarget')

contract('Pool app', accounts => {
  let factory, dao, acl, pBase, pool, poolId
  let ETH,
    ANY_ENTITY,
    APP_MANAGER_ROLE,
    SAFE_EXECUTE_ROLE,
    ADD_COLLATERAL_TOKEN_ROLE,
    REMOVE_COLLATERAL_TOKEN_ROLE

  const root = accounts[0]
  const authorized = accounts[1]
  const unauthorized = accounts[2]

  before(async () => {
    // factory
    const kBase = await Kernel.new(true) // petrify immediately
    const aBase = await ACL.new()
    const rFact = await EVMScriptRegistryFactory.new()
    pBase = await Pool.new()
    factory = await DAOFactory.new(kBase.address, aBase.address, rFact.address)

    // constants
    ETH = await (await EtherTokenConstantMock.new()).getETHConstant()
    ANY_ENTITY = await aBase.ANY_ENTITY()
    APP_MANAGER_ROLE = await kBase.APP_MANAGER_ROLE()
    SAFE_EXECUTE_ROLE = await pBase.SAFE_EXECUTE_ROLE()
    ADD_COLLATERAL_TOKEN_ROLE = await pBase.ADD_COLLATERAL_TOKEN_ROLE()
    REMOVE_COLLATERAL_TOKEN_ROLE = await pBase.REMOVE_COLLATERAL_TOKEN_ROLE()
  })

  beforeEach(async () => {
    // dao
    const dReceipt = await factory.newDAO(root)
    dao = await Kernel.at(getEvent(dReceipt, 'DeployDAO', 'dao'))
    acl = ACL.at(await dao.acl())
    await acl.createPermission(root, dao.address, APP_MANAGER_ROLE, root, {
      from: root
    })

    // pool
    poolId = hash('fundraising-pool.aragonpm.eth')
    const pReceipt = await dao.newAppInstance(
      poolId,
      pBase.address,
      '0x',
      false
    )
    pool = await Pool.at(getEvent(pReceipt, 'NewAppProxy', 'proxy'))

    await acl.createPermission(
      authorized,
      pool.address,
      SAFE_EXECUTE_ROLE,
      root,
      {
        from: root
      }
    )
    await acl.createPermission(
      authorized,
      pool.address,
      ADD_COLLATERAL_TOKEN_ROLE,
      root,
      {
        from: root
      }
    )
    await acl.createPermission(
      authorized,
      pool.address,
      REMOVE_COLLATERAL_TOKEN_ROLE,
      root,
      {
        from: root
      }
    )

    await pool.initialize()
  })

  // ADD ASSERT EVENT EVERYWHERE
  // Check tokenIndex too.

  context('> initialize', () => {
    it('it should revert on re-initialization', async () => {
      await assertRevert(async () => await pool.initialize())
    })
  })

  context('> addCollateralToken', () => {
    context('sender has ADD_COLLATERAL_TOKEN_ROLE', () => {
      context('and token is ETH or ERC20', () => {
        context('and token does not already exist in mapping', () => {
          it('it should add collateral token in mapping', async () => {
            const token2 = await TokenMock.new(authorized, 10000)
            const token3 = await TokenMock.new(authorized, 10000)

            await pool.addCollateralToken(ETH, { from: authorized })
            await pool.addCollateralToken(token2.address, { from: authorized })
            await pool.addCollateralToken(token3.address, { from: authorized })

            const collateralTokensLength = await pool.collateralTokensLength()
            const address1 = await pool.collateralTokens(1)
            const address2 = await pool.collateralTokens(2)
            const address3 = await pool.collateralTokens(3)

            assert.equal(collateralTokensLength, 3)
            assert.equal(ETH, address1)
            assert.equal(token2.address, address2)
            assert.equal(token3.address, address3)
          })
        })
        context('but token already exists in mapping', () => {
          it('it should revert', async () => {
            const token = await TokenMock.new(authorized, 10000)
            await pool.addCollateralToken(token.address, { from: authorized })

            await assertRevert(
              async () =>
                await pool.addCollateralToken(token.address, {
                  from: authorized
                })
            )
          })
        })
      })
      context('but token is not ETH or ERC20', () => {
        it('it should revert', async () => {
          await assertRevert(
            async () =>
              await pool.addCollateralToken(root, { from: authorized })
          )
        })
      })
    })
    context('sender does not have ADD_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        const token = await TokenMock.new(authorized, 10000)

        await assertRevert(
          async () =>
            await pool.addCollateralToken(token.address, { from: unauthorized })
        )
      })
    })
  })

  context('> removeCollateralToken', () => {
    context('sender has REMOVE_COLLATERAL_TOKEN_ROLE', () => {
      context('and token already exists in mapping', () => {
        it('it should remove collateral token from mapping', async () => {
          const token2 = await TokenMock.new(authorized, 10000)
          const token3 = await TokenMock.new(authorized, 10000)

          await pool.addCollateralToken(ETH, { from: authorized })
          await pool.addCollateralToken(token2.address, { from: authorized })
          await pool.addCollateralToken(token3.address, { from: authorized })

          await pool.removeCollateralToken(token2.address, { from: authorized })

          const collateralTokensLength = await pool.collateralTokensLength()
          const address1 = await pool.collateralTokens(1)
          const address2 = await pool.collateralTokens(2)

          assert.equal(collateralTokensLength, 2)
          assert.equal(ETH, address1)
          assert.equal(token3.address, address2)
        })
      })
      context('but token does not already exist in mapping', () => {
        it('it should revert', async () => {
          const token1 = await TokenMock.new(authorized, 10000)
          const token2 = await TokenMock.new(authorized, 10000)
          await pool.addCollateralToken(token1.address, { from: authorized })

          await assertRevert(
            async () =>
              await pool.removeCollateralToken(token2.address, {
                from: authorized
              })
          )
        })
      })
    })

    context('sender does not have REMOVE_COLLATERAL_TOKEN_ROLE', () => {
      it('it should revert', async () => {
        const token = await TokenMock.new(authorized, 10000)
        await pool.addCollateralToken(token.address, { from: authorized })

        await assertRevert(
          async () =>
            await pool.removeCollateralToken(token.address, {
              from: unauthorized
            })
        )
      })
    })
  })

  context('> safeExecute', () => {
    const noData = '0x'
    const amount = 1000
    let target, token1, token2, data

    beforeEach(async () => {
      target = await ExecutionTarget.new()
      token1 = await TokenMock.new(pool.address, amount)
      token2 = await TokenMock.new(pool.address, amount)

      await pool.addCollateralToken(ETH, { from: authorized })
      await pool.addCollateralToken(token1.address, { from: authorized })
      await pool.addCollateralToken(token2.address, { from: authorized })

      assert.equal(await target.counter(), 0)
      assert.equal(await token1.balanceOf(pool.address), amount)
      assert.equal(await token2.balanceOf(pool.address), amount)
    })

    context('sender has SAFE_EXECUTE_ROLE', () => {
      context('> target is not a collateralized ERC20', () => {
        it('it can execute actions', async () => {
          const N = 1102
          const data = target.contract.setCounter.getData(N)

          const receipt = await pool.safeExecute(target.address, data, {
            from: authorized
          })

          assertEvent(receipt, 'SafeExecute')
          assert.equal(await target.counter(), N)
        })

        it('it can execute actions without data', async () => {
          const receipt = await pool.safeExecute(target.address, noData, {
            from: authorized
          })

          assertEvent(receipt, 'SafeExecute')
          assert.equal(await target.counter(), 1) // fallback just runs ExecutionTarget.execute()
        })

        it('it can execute cheap fallback actions', async () => {
          const cheapFallbackTarget = await DestinationMock.new(false)
          const receipt = await pool.safeExecute(
            cheapFallbackTarget.address,
            noData,
            { from: authorized }
          )

          assertEvent(receipt, 'SafeExecute')
        })

        it('it can execute expensive fallback actions', async () => {
          const expensiveFallbackTarget = await DestinationMock.new(true)
          assert.equal(await expensiveFallbackTarget.counter(), 0)

          const receipt = await pool.safeExecute(
            expensiveFallbackTarget.address,
            noData,
            { from: authorized }
          )

          assertEvent(receipt, 'SafeExecute')
          assert.equal(await expensiveFallbackTarget.counter(), 1) // fallback increments counter
        })

        it('it can execute with data when target is not a contract', async () => {
          const nonContract = accounts[8] // random account
          const nonContractBalance = await getBalance(nonContract)
          const randomData = '0x12345678'

          const receipt = await pool.safeExecute(nonContract, randomData, {
            from: authorized
          })

          assertEvent(receipt, 'SafeExecute')
        })

        it('it can execute without data when target is not a contract', async () => {
          const nonContract = accounts[8] // random account

          const receipt = await pool.safeExecute(nonContract, noData, {
            from: authorized
          })

          assertEvent(receipt, 'SafeExecute')
        })

        it('it can forward success return data', async () => {
          const { to, data } = encodeFunctionCall(target, 'execute')

          // We make a call to easily get what data could be gotten inside the EVM
          // Contract -> agent.execute -> Target.func (would allow Contract to have access to this data)
          const call = encodeFunctionCall(pool, 'safeExecute', to, data, {
            from: authorized
          })
          const returnData = await web3Call(call)

          // ExecutionTarget.execute() increments the counter by 1
          assert.equal(ethABI.decodeParameter('uint256', returnData), 1)
        })
        //
        it('it should revert if executed action reverts', async () => {
          // TODO: Check revert data was correctly forwarded
          // ganache currently doesn't support fetching this data

          const data = target.contract.fail.getData()
          await assertRevert(() =>
            pool.safeExecute(target.address, data, {
              from: authorized
            })
          )
        })
      })

      context('> target is a collateralized ERC20', () => {
        it('it should revert', async () => {
          const approve = token1.contract.approve.getData(target.address, 10)

          await assertRevert(
            async () =>
              await pool.safeExecute(token1.address, approve, {
                from: authorized
              })
          )
        })
      })

      context(
        '> target is not a collateralized ERC20 but action affects a collateralized ERC20 balance',
        () => {
          it('it should revert', async () => {
            const token3 = await TokenMock.new(pool.address, amount)
            const approve = token3.contract.approve.getData(target.address, 10)
            await pool.safeExecute(token3.address, approve, {
              from: authorized
            }) // target is now allowed to transfer on behalf of pool
            await pool.addCollateralToken(token3.address, { from: authorized }) // token3 is now collateralized
            const data = target.contract.transferTokenFrom.getData(
              token3.address
            )

            await assertRevert(
              async () =>
                await pool.safeExecute(target.address, data, {
                  from: authorized
                })
            )
          })
        }
      )
    })

    context('> sender does not have SAFE_EXECUTE_ROLE', () => {
      it('it should revert', async () => {
        const data = target.contract.execute.getData()

        await assertRevert(() =>
          pool.safeExecute(target.address, data, {
            from: unauthorized
          })
        )
      })
    })
  })
})