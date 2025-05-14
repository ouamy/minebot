const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const mcData = require('minecraft-data')('1.20.4')
const { GoalNear } = goals
const { exec } = require('child_process')

let bot = null
let retrying = false
let creatingBot = false
let inGhostServer = false

function safeChat(message) {
  try {
    if (bot && bot.chat && typeof bot.chat === 'function') {
      bot.chat(message)
    }
  } catch (e) {
    console.log("Error in safeChat:", e.message)
  }
}

function stopMovement() {
  if (bot) {
    bot.setControlState('forward', false)
    bot.setControlState('back', false)
    bot.setControlState('left', false)
    bot.setControlState('right', false)
    bot.setControlState('jump', false)
  }
}

function startAntiAFK() {
  const interval = setInterval(() => {
    if (!bot || !bot.setControlState) {
      clearInterval(interval)
      return
    }

    stopMovement()

    const actions = [
      () => bot.setControlState('forward', true),
      () => bot.setControlState('back', true),
      () => bot.setControlState('left', true),
      () => bot.setControlState('right', true),
      () => bot.setControlState('jump', true),
      () => bot.swingArm(),
      () => {
        if (bot.entity?.yaw !== undefined) {
          const yaw = Math.random() * 2 * Math.PI
          const pitch = (Math.random() - 0.5) * Math.PI / 4
          bot.look(yaw, pitch, true)
        }
      }
    ]

    const action = actions[Math.floor(Math.random() * actions.length)]
    action()
    setTimeout(stopMovement, 1000 + Math.random() * 1000)
  }, 5000)
}

function ensureBotIsReady() {
  if (bot?.entity?.yaw !== undefined) {
    startAntiAFK()
  } else {
    setTimeout(ensureBotIsReady, 10000)
  }
}

function ghostServerMode(botInstance) {
  const bed = botInstance.findBlocks({
    matching: block => botInstance.isABed(block),
    maxDistance: 16,
    count: 1
  })[0]

  const chest = botInstance.findBlocks({
    matching: block => block.name === 'chest',
    maxDistance: 8,
    count: 1
  })[0]

  const playersNearby = Object.keys(botInstance.players).filter(name => name !== botInstance.username).length

  if (!bed && !chest && playersNearby === 0) {
    inGhostServer = true
    if (!retrying) {
      retrying = true
      exec('node index.js --start', (error, stdout, stderr) => {
        if (error) console.error(`Start script error: ${error.message}`)
        if (stderr) console.error(`Start script stderr: ${stderr}`)
        console.log(`Start script stdout: ${stdout}`)
        console.log('Waiting 60 seconds before retrying connection...')
        setTimeout(createBot, 60000)
      })
    }
  } else {
    inGhostServer = false
    setTimeout(() => ghostServerMode(botInstance), 10000)
  }
}

function createBot() {
  if (creatingBot) return
  creatingBot = true

  if (bot) {
    try { bot.quit() } catch (_) {}
    bot = null
  }

  const newBot = mineflayer.createBot({
    host: 'trupiloztaerzi.aternos.me',
    username: 'AntiAFKBot',
    version: '1.20.4'
  })

  bot = newBot
  newBot.loadPlugin(pathfinder)

  newBot.once('spawn', () => {
    console.log('Bot spawned in the server.')
    ghostServerMode(newBot)
    creatingBot = false
    retrying = false
    if (newBot.entity?.yaw !== undefined) {
      newBot.pathfinder.setMovements(new Movements(newBot, mcData))
      startAntiAFK()
    } else {
      setTimeout(ensureBotIsReady, 10000)
    }
  })

  newBot.on('chat', async (username, message) => {
    if (username === newBot.username) return

    if (message === 'bot stats') {
      const healthBars = Math.floor(newBot.health / 2)
      const hungerBars = Math.floor(newBot.food / 2)
      let hungerDescription = 'Full'
      if (newBot.food < 20 && newBot.food >= 14) hungerDescription = 'Satisfied'
      else if (newBot.food < 14 && newBot.food >= 7) hungerDescription = 'Hungry'
      else if (newBot.food < 7) hungerDescription = 'Starving'
      safeChat(`Health: ${healthBars}/10 | Hunger: ${hungerDescription} (${hungerBars}/10)`)
    }

    if (message === 'bot position') {
      if (!newBot.entity?.position) return safeChat("Bot's position is not available yet.")
      const pos = newBot.entity.position
      safeChat(`Position: x=${pos.x.toFixed(2)} y=${pos.y.toFixed(2)} z=${pos.z.toFixed(2)}`)
    }

    if (message === 'bot sleep') {
      if (!newBot.entity) return safeChat("I'm not ready yet, please wait a moment.")
      const bed = newBot.findBlock({
        matching: block => newBot.isABed(block),
        maxDistance: 16
      })

      if (!bed) return safeChat("No bed found nearby.")
      try {
        await newBot.pathfinder.goto(new GoalNear(bed.position.x, bed.position.y, bed.position.z, 1))
        await newBot.sleep(bed)
        safeChat("I'm sleeping.")
      } catch (err) {
        safeChat("Couldn't sleep: " + err.message)
      }
    }

    if (message === 'bot eat') {
      const chestToUse = newBot.findBlock({
        matching: block => block.name === 'chest',
        maxDistance: 8
      })

      if (!chestToUse) return safeChat("No chest nearby to eat from.")

      try {
        await newBot.pathfinder.goto(new GoalNear(chestToUse.position.x, chestToUse.position.y, chestToUse.position.z, 1))
        const chest = await newBot.openChest(newBot.blockAt(chestToUse.position))
        const foodItem = chest.containerItems().find(item =>
          item.name.includes('bread') || item.name.includes('apple') || item.name.includes('steak') || item.name.includes('carrot')
        )

        if (!foodItem) {
          chest.close()
          return safeChat("No food found in the chest.")
        }

        await chest.withdraw(foodItem.type, null, 1)
        chest.close()

        const foodInInventory = newBot.inventory.items().find(item =>
          item.name.includes('bread') || item.name.includes('apple') || item.name.includes('steak') || item.name.includes('carrot')
        )

        if (foodInInventory) {
          await newBot.equip(foodInInventory, 'hand')
          await newBot.consume()
          safeChat("I ate some food.")
        } else {
          safeChat("I don't have any food to eat.")
        }
      } catch (err) {
        safeChat("Error while eating: " + err.message)
      }
    }
  })

  newBot.on('end', () => {
    console.log('Disconnected from server.')
    bot = null
    creatingBot = false
    if (inGhostServer) {
      console.log('Reconnecting due to ghost server...')
      setTimeout(createBot, 10000)
    }
  })

  newBot.on('error', (err) => {
    console.log('Error detected:', err.message)
    creatingBot = false
    if (!retrying && (err.message.includes('ENOTFOUND') || err.message.includes('ECONNRESET'))) {
      retrying = true
      exec('node index.js --start', (error, stdout, stderr) => {
        if (error) console.error(`Start script error: ${error.message}`)
        if (stderr) console.error(`Start script stderr: ${stderr}`)
        console.log(`Start script stdout: ${stdout}`)
        console.log('Waiting 60 seconds before retrying connection...')
        setTimeout(createBot, 60000)
      })
    }
  })

  newBot.on('kicked', (reason) => {
    console.log('Kicked from server:', reason)
    bot = null
    creatingBot = false
    const reasonCode = reason?.value?.translate

    if (reasonCode === 'multiplayer.disconnect.duplicate_login') {
      console.log('Handling duplicate login... Reconnecting...')
      setTimeout(createBot, 10000)
    } else if (reasonCode === 'multiplayer.disconnect.server_shutdown' && !retrying) {
      console.log('Server is shutting down. Attempting to restart...')
      retrying = true
      exec('node index.js --start', (error, stdout, stderr) => {
        if (error) console.error(`Start script error: ${error.message}`)
        if (stderr) console.error(`Start script stderr: ${stderr}`)
        console.log(`Start script stdout: ${stdout}`)
        console.log('Waiting 60 seconds before retrying connection...')
        setTimeout(createBot, 60000)
      })
    } else {
      console.log('Reconnecting after kick...')
      setTimeout(createBot, 10000)
    }
  })
}

createBot()

