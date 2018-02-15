const five = require('johnny-five')
const moment = require('moment')
const board = new five.Board({ port: 'COM3' })

let upButton, downButton, modeButton, infoLed, sunriseLed, piezo, lcd
let alarmOn = true
let alarmDismissed = true
let nextAlarm = moment().add(1, 'hour').set({seconds: 0}) // alarm defaults to 1 hour from now
let previousAlarm = moment(0) // used to keep it sunny after alarm
let pauseDisplay = false

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
    nextAlarm.add(snoozeTime, 'minutes')
  } else { // adjust future alarm
    nextAlarm.add(button === 'up' ? amount : -amount, 'minutes')
  }

  tick() // force immediate update
}

function updateDisplay () {
  if (pauseDisplay) return // using piezo + display together uses too much power and causes issues, so pause updates during alarm

  const now = moment()

  let alarmMessage = 'No alarm'
  if (alarmOn) {
    const hoursLeft = nextAlarm.diff(now, 'hours')
    const minsLeft = nextAlarm.diff(now, 'minutes')
    const secsLeft = nextAlarm.diff(now, 'seconds')
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
  const bottomRow = `:bell: ${nextAlarm.format('HH:mm')} ${alarmMessage.padStart(8)}`

  lcd.home().print(topRow).cursor(1, 0).print(bottomRow)
  console.log(topRow, '|', bottomRow)
}

function checkAlarmDate () {
  if (!alarmDismissed) return // don't change the alarm if it's currently ringing

  const now = moment()
  if (nextAlarm.isBefore(now)) {
    nextAlarm.add(1, 'day')
  } else if (nextAlarm.isAfter(now.add(1, 'day'))) {
    nextAlarm.subtract(1, 'day')
  }
}

function tick () {
  checkAlarmDate()
  updateDisplay()

  alarmOn ? infoLed.on() : infoLed.off()

  // Gradually get brighter/dimmer 30 mins before/after alarm
  const minsSince = moment().diff(previousAlarm, 'minutes')
  const minsLeft = nextAlarm.diff(moment(), 'minutes')
  if (minsSince < 30 || (alarmOn && minsLeft < 30)) {
    const sunlight = !alarmDismissed ? 255 : Math.round(((30 - Math.min(minsLeft, minsSince)) / 30) * 255)
    sunriseLed.brightness(sunlight)
    console.log(`Sunlight: ${sunlight}/255`)
  } else {
    sunriseLed.off()
  }

  if (alarmOn && moment().isSame(nextAlarm, 'seconds')) {
    pauseDisplay = true
    alarmDismissed = false
    soundAlarm()
  }
}

function soundAlarm () {
  piezo.play('C -', () => { // callback is fired after every alarm 'beep'
    if (!alarmDismissed && nextAlarm.isSameOrBefore(moment())) {
      soundAlarm()
      return
    } else if (!alarmDismissed) {
      console.log('Alarm snoozed')
    } else {
      console.log('Alarm dismissed')
      nextAlarm.add(1, 'day').set({ seconds: 0 })
    }
    previousAlarm = moment()
    pauseDisplay = false
  })
}

board.on('ready', () => {
  setupHardware()
  setInterval(tick, 1000)

  board.repl.inject({
    // Easily set an alarm from terminal
    a (amount = 5, units = 'seconds') {
      nextAlarm = moment().add(amount, units)
    }
  })
})
