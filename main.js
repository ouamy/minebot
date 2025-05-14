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
      const health = bot.health
      const food = bot.food
      const healthBars = Math.floor(health / 2)
      const hungerBars = Math.floor(food / 2)
      let hungerDescription = 'Full'
      if (food < 20 && food >= 14) hungerDescription = 'Satisfied'
      else if (food < 14 && food >= 7) hungerDescription = 'Hungry'
      else if (food < 7) hungerDescription = 'Starving'
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

      if (!bed) {
        bot.chat("No bed found nearby")
        return
      }

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

      if (!chestToUse) {
        bot.chat("No chest nearby to eat from")
        return
      }

      try {
        await bot.pathfinder.goto(new GoalNear(chestToUse.position.x, chestToUse.position.y, chestToUse.position.z, 1))
        const chest = await bot.openChest(bot.blockAt(chestToUse.position))

        const foodItem = chest.containerItems().find(item =>
          item.name.includes('bread') || item.name.includes('apple') || item.name.includes('steak') || item.name.includes('carrot')
        )

        if (!foodItem) {
          chest.close()
          bot.chat("No food found in the chest")
          return
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

    if (!retrying && err.message.includes('ENOTFOUND')) {
      console.log('Server seems offline. Attempting to start it...')
      retrying = true

      exec('node aternosAPI/src/index.js --start', (error, stdout, stderr) => {
        setTimeout(createBot, 30000) // retry after 30 seconds
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

