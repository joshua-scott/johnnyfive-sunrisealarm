const five = require('johnny-five')
const moment = require('moment')
const board = new five.Board({ port: 'COM3' })

let alarmOn = true
let keepPlaying = true
let alarmTime = moment().add(1, 'hour').set({seconds: 0}) // alarm defaults to 1 hour from now

function setupHardware () {
  led = new five.Led(13)
  piezo = new five.Piezo(5)
  upButton = new five.Button({ pin: 3, holdtime: 250 })
  downButton = new five.Button({ pin: 2, holdtime: 250 })
  modeButton = new five.Button({ pin: 4, holdtime: 500 })
  
  // tap mode button to turn off currently playing alarm
  modeButton.on('down', () => keepPlaying = false)
  
  // hold mode button to toggle alarm on/off
  modeButton.on('hold', () => {
    alarmOn = !alarmOn
    console.log(`Alarm is now ${alarmOn ? 'on' : 'off'}`)
  })

  // tapping up or down button changes alarm time by 1 minute
  // holding changes alarm time by 10 mins (per 250ms)
  downButton.on('down', () => setAlarm('down', 1))
  downButton.on('hold', () => setAlarm('down', 10))
  upButton.on('down', () => setAlarm('up', 1))
  upButton.on('hold', () => setAlarm('up', 10))
  
  console.log('Ready!')
}

function setAlarm (direction, amount) {
  if (direction === 'up') {
    alarmTime.add(amount, 'minutes')
  } else {
    alarmTime.subtract(amount, 'minutes')
  }

  // adjust date of alarm if needed
  const now = moment()
  if (alarmTime.isBefore(now)) {
    alarmTime.add(1, 'day')
  } else if (alarmTime.isAfter(now.add(1, 'day'))) {
    alarmTime.subtract(1, 'day')
  }

  showStatus()
}

function showStatus () {
  console.log(`Current time: ${moment().format('HH:mm:ss')}\tAlarm time: ${alarmTime.format('HH:mm:ss')} (${alarmTime.fromNow()})\talarmOn: ${alarmOn}`)
}

function tick () {
  showStatus()

  alarmOn ? led.on() : led.off()
  
  if (alarmOn && moment().isSame(alarmTime, 'seconds')) {
    keepPlaying = true
    soundAlarm()
    alarmTime.add(1, 'day').set({seconds: 0})
  }
}

function soundAlarm () {
  piezo.play('C -', () => {
    keepPlaying ? soundAlarm() : console.log('Alarm stopped')
  })
}

board.on('ready', () => {
  setupHardware()
  setInterval(tick, 1000)

  board.repl.inject({
    // Easily set an alarm from terminal (defaults to five seconds from now, or pass an argument)
    a (when = moment().add(5, 'seconds')) {
      alarmTime = when
    }
  })
})
