const five = require('johnny-five')
const moment = require('moment')
const board = new five.Board({ port: 'COM3' })

let upButton, downButton, modeButton, infoLed, sunriseLed, piezo, lcd

let alarmOn = true
let alarmDismissed = true
let pauseDisplay = false
let alarmTime = moment().add(1, 'hour').set({seconds: 0}) // alarm defaults to 1 hour from now
let previousAlarm = moment(0) // used to keep it sunny after alarm

function setupHardware () {
  upButton = new five.Button({ pin: 2, holdtime: 250 })
  downButton = new five.Button({ pin: 3, holdtime: 250 })
  modeButton = new five.Button({ pin: 4, holdtime: 500 })
  infoLed = new five.Led(5)
  sunriseLed = new five.Led(6)
  piezo = new five.Piezo(7)
  lcd = new five.LCD({
    pins: [8, 9, 10, 11, 12, 13],
    rows: 2,
    cols: 16
  })
  lcd.useChar('clock')
  lcd.useChar('bell')

  // tap mode button to turn off currently playing alarm
  modeButton.on('down', () => { alarmDismissed = true })

  // hold mode button to toggle upcoming alarm on/off
  modeButton.on('hold', () => {
    alarmOn = !alarmOn
    console.log(`Alarm is now ${alarmOn ? 'on' : 'off'}`)
  })

  // if alarm is playing, snooze by 1 min (up button) or 10 mins (down button)
  // else tapping up or down button changes alarm time by 1 minute
  // holding changes alarm time by 10 mins (per 250ms)
  upButton.on('down', () => setAlarm('up', 1))
  upButton.on('hold', () => setAlarm('up', 10))
  downButton.on('down', () => setAlarm('down', 1))
  downButton.on('hold', () => setAlarm('down', 10))

  console.log('Ready!')
}

function setAlarm (button, amount) {
  if (!alarmDismissed) { // snooze currently playing alarm
    const snoozeTime = button === 'up' ? 1 : 10
    alarmTime.add(snoozeTime, 'minutes')
    console.log(`Alarm snoozed for ${snoozeTime} minutes`)
  } else { // adjust future alarm
    alarmTime.add(button === 'up' ? amount : -amount, 'minutes')
  }

  // adjust date of alarm if needed
  const now = moment()
  if (alarmTime.isBefore(now)) {
    alarmTime.add(1, 'day')
  } else if (alarmTime.isAfter(now.add(1, 'day'))) {
    alarmTime.subtract(1, 'day')
  }

  updateDisplay()
}

function updateDisplay () {
  if (pauseDisplay) return // using piezo + display together uses too much power and causes issues, so pause updates during alarm

  const now = moment()

  let alarmMessage = 'No alarm'
  if (alarmOn) {
    const hoursLeft = alarmTime.diff(now, 'hours')
    const minsLeft = alarmTime.diff(now, 'minutes')
    const secsLeft = alarmTime.diff(now, 'seconds')
    if (hoursLeft > 0) {
      alarmMessage = `${hoursLeft}h ${minsLeft % 60}m`
    } else if (minsLeft > 0) {
      alarmMessage = `${minsLeft}m ${secsLeft % 60}s`
    } else {
      alarmMessage = `${secsLeft}s`
    }
  }

  const dateInfo = now.format(now.seconds() % 2 ? 'ddd' : 'D/M')
  const topRow = `:clock: ${now.format('HH:mm:ss')} ${dateInfo.padStart(5)}`
  const bottomRow = `:bell: ${alarmTime.format('HH:mm')} ${alarmMessage.padStart(8)}`

  lcd.home().print(topRow).cursor(1, 0).print(bottomRow)
  console.log(topRow, '|', bottomRow)
}

function tick () {
  updateDisplay()

  alarmOn ? infoLed.on() : infoLed.off()

  // Gradually get brighter/dimmer 30 mins before/after alarm
  const minsLeft = alarmTime.diff(moment(), 'minutes')
  const minsSince = moment().diff(previousAlarm, 'minutes')
  if (minsSince < 30 || (alarmOn && minsLeft < 30)) {
    const sunlight = !alarmDismissed ? 255 : Math.round(((30 - Math.min(minsLeft, minsSince)) / 30) * 255)
    sunriseLed.brightness(sunlight)
    console.log(`Sunlight: ${sunlight}/255`)
  }

  if (alarmOn && moment().isSame(alarmTime, 'seconds')) {
    pauseDisplay = true
    alarmDismissed = false
    soundAlarm()
  }
}

function soundAlarm () {
  piezo.play('C -', () => { // callback is fired after every alarm 'beep'
    if (!alarmDismissed && alarmTime.isSameOrBefore(moment())) {
      soundAlarm()
    } else if (!alarmDismissed) { // user hit snooze
      pauseDisplay = false
    } else { // user dismissed alarm
      console.log('Alarm dismissed')
      alarmTime.add(1, 'day').set({ seconds: 0 })
      pauseDisplay = false
    }
    previousAlarm = moment()
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

/*
todo:
- When alarm is not sounding:
  - tapping modeButton should swap between showing day/date/hourChange/minChange
  - holding up/down button outside of changeTime mode could activate 'secrets'. e.g. strobe mode? a game?? Just an idea...
*/
