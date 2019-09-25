const test = require('tape-promise').default(require('tape'))

const { createBundleFromRequiresArray } = require('./util')

test('attack - prevent primitive modification', async (t) => {
  const depsArray = [
    {
      'id': '/1.js',
      'file': '/1.js',
      'source': "require('foo'); global.testResult = !!Object.xyz",
      'deps': { 'foo': '/node_modules/2/index.js' },
      'entry': true
    },
    {
      'id': '/node_modules/2/index.js',
      'file': '/node_modules/2/index.js',
      'source': 'try { Object.xyz = 123 } catch (_) { }',
      'deps': {}
    }
  ]

  const sesifyConfig = {}
  const result = await createBundleFromRequiresArray(depsArray, sesifyConfig)

  eval(result)
  t.equal(global.testResult, false)
})

test('attack - limit platform api', async (t) => {
  const depsArray = [
    {
      'id': '/1.js',
      'file': '/1.js',
      'source': "global.testResult = typeof require('foo') === 'function'",
      'deps': { 'foo': '/node_modules/2/index.js' },
      'entry': true
    },
    {
      'id': '/node_modules/2/index.js',
      'file': '/node_modules/2/index.js',
      'source': 'try { module.exports = setTimeout } catch (_) {}',
      'deps': {}
    }
  ]

  const sesifyConfig = {}
  const result = await createBundleFromRequiresArray(depsArray, sesifyConfig)

  eval(result)
  t.equal(global.testResult, false)
})

test('attack - prevent module cache attack', async (t) => {

  function defineAttacker () {
    try {
      require('victim').action = () => true
    } catch (_) {}
  }

  function defineVictim () {
    module.exports.action = () => false
  }

  await testEntryAttackerVictim(t, { defineAttacker, defineVictim })
})

async function testEntryAttackerVictim (t, { defineAttacker, defineVictim }) {

  function defineEntry () {
    require('attacker')
    const result = require('victim').action()
    global.testResult = result
  }

  const depsArray = [
    {
      'id': '/1.js',
      'file': '/1.js',
      'source': `(${defineEntry})()`,
      'deps': {
        'attacker': '/node_modules/2/index.js',
        'victim': '/node_modules/3/index.js'
      },
      'entry': true
    },
    {
      'id': '/node_modules/2/index.js',
      'file': '/node_modules/2/index.js',
      'source': `(${defineAttacker})()`,
      'deps': {
        'victim': '/node_modules/3/index.js'
      }
    },
    {
      'id': '/node_modules/3/index.js',
      'file': '/node_modules/3/index.js',
      'source': `(${defineVictim})()`,
      'deps': {}
    }
  ]

  const sesifyConfig = {}
  const result = await createBundleFromRequiresArray(depsArray, sesifyConfig)

  eval(result)
  t.equal(global.testResult, false)
}