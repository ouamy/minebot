const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const mcData = require('minecraft-data')('1.20.4')
const { GoalNear } = goals
const { exec } = require('child_process')

let bot
let retrying = false

function createBot() {
  bot = mineflayer.createBot({
    host: 'trupiloztaerzi.aternos.me',
    username: 'AntiAFKBot',
    version: '1.20.4'
  })

  bot.loadPlugin(pathfinder)

  bot.on('spawn', () => {
    console.log('Bot spawned in the server.')
    retrying = false
    const defaultMove = new Movements(bot, mcData)
    bot.pathfinder.setMovements(defaultMove)
    startAntiAFK()
  })

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return

    if (message === 'bot stats') {
      const healthBars = Math.floor(bot.health / 2)
      const hungerBars = Math.floor(bot.food / 2)
      let hungerDescription = 'Full'
      if (bot.food < 20 && bot.food >= 14) hungerDescription = 'Satisfied'
      else if (bot.food < 14 && bot.food >= 7) hungerDescription = 'Hungry'
      else if (bot.food < 7) hungerDescription = 'Starving'
      bot.chat(`Health: ${healthBars}/10 | Hunger: ${hungerDescription} (${hungerBars}/10)`)
    }

    if (message === 'bot position') {
      const pos = bot.entity.position
      bot.chat(`Position: x=${pos.x.toFixed(2)} y=${pos.y.toFixed(2)} z=${pos.z.toFixed(2)}`)
    }

    if (message === 'bot sleep') {
      const bed = bot.findBlock({
        matching: block => bot.isABed(block),
        maxDistance: 16
      })

      if (!bed) return bot.chat("No bed found nearby")

      try {
        await bot.pathfinder.goto(new GoalNear(bed.position.x, bed.position.y, bed.position.z, 1))
        await bot.sleep(bed)
        bot.chat("I'm sleeping")
      } catch (err) {
        bot.chat("Couldn't sleep: " + err.message)
      }
    }

    if (message === 'bot eat') {
      const chestToUse = bot.findBlock({
        matching: block => block.name === 'chest',
        maxDistance: 8
      })

      if (!chestToUse) return bot.chat("No chest nearby to eat from")

      try {
        await bot.pathfinder.goto(new GoalNear(chestToUse.position.x, chestToUse.position.y, chestToUse.position.z, 1))
        const chest = await bot.openChest(bot.blockAt(chestToUse.position))
        const foodItem = chest.containerItems().find(item =>
          item.name.includes('bread') || item.name.includes('apple') || item.name.includes('steak') || item.name.includes('carrot')
        )

        if (!foodItem) {
          chest.close()
          return bot.chat("No food found in the chest")
        }

        await chest.withdraw(foodItem.type, null, 1)
        chest.close()

        const foodInInventory = bot.inventory.items().find(item =>
          item.name.includes('bread') || item.name.includes('apple') || item.name.includes('steak') || item.name.includes('carrot')
        )

        if (foodInInventory) {
          await bot.equip(foodInInventory, 'hand')
          await bot.consume()
          bot.chat("I ate some food")
        } else {
          bot.chat("I don't have any food to eat")
        }
      } catch (err) {
        bot.chat("Error while eating: " + err.message)
      }
    }
  })

  bot.on('end', () => {
    if (bot && bot.setControlState) {
      ['forward', 'back', 'left', 'right', 'jump'].forEach(key => bot.setControlState(key, false))
    }
    console.log('Disconnected from server, reconnecting in 5 seconds...')
    setTimeout(createBot, 5000)
  })

  bot.on('error', (err) => {
    console.log('Error detected:', err.message)

    if (!retrying && (err.message.includes('ENOTFOUND') || err.message.includes('ECONNRESET'))) {
      console.log('Server might be offline or resetting. Attempting to start it...')
      retrying = true

      exec('node index.js --start', (error, stdout, stderr) => {
        if (error) {
          console.error(`Start script error: ${error.message}`)
        }
        if (stderr) {
          console.error(`Start script stderr: ${stderr}`)
        }
        console.log(`Start script stdout: ${stdout}`)
        console.log('Waiting 30 seconds before retrying connection...')
        setTimeout(createBot, 30000)
      })
    }
  })

  bot.on('kicked', (reason) => {
    console.log('Kicked from server:', reason)
  })

  function startAntiAFK() {
    const actions = [
      () => bot.setControlState('forward', true),
      () => bot.setControlState('back', true),
      () => bot.setControlState('left', true),
      () => bot.setControlState('right', true),
      () => bot.setControlState('jump', true),
      () => bot.swingArm(),
      () => {
        const yaw = Math.random() * 2 * Math.PI
        const pitch = (Math.random() - 0.5) * Math.PI / 4
        bot.look(yaw, pitch, true)
      }
    ]

    const stopMovement = () => {
      bot.setControlState('forward', false)
      bot.setControlState('back', false)
      bot.setControlState('left', false)
      bot.setControlState('right', false)
      bot.setControlState('jump', false)
    }

    setInterval(() => {
      stopMovement()
      const action = actions[Math.floor(Math.random() * actions.length)]
      action()
      setTimeout(stopMovement, 1000 + Math.random() * 1000)
    }, 5000)
  }
}

createBot()

