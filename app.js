const five = require('johnny-five')
const moment = require('moment')
const board = new five.Board({ port: 'COM3' })

const shortSnooze = 5
const longSnooze = 25

let upButton, downButton, modeButton, infoLed, sunriseLed, piezo, lcd
let alarmOn = true
let alarmDismissed = true
let nextAlarm = moment().add(1, 'hour').set({seconds: 0})
let previousAlarm = moment(0)
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

  // tap mode button to turn off ringing alarm
  modeButton.on('down', () => { alarmDismissed = true })

  // hold mode button to toggle upcoming alarm on/off
  modeButton.on('hold', () => {
    alarmOn = !alarmOn
    console.log(`Alarm is now ${alarmOn ? 'on' : 'off'}`)
  })

  // arrow buttons snooze ringing alarm, or adjust time of upcoming alarm
  upButton.on('down', () => setAlarm('up', 1))
  upButton.on('hold', () => setAlarm('up', 10))
  downButton.on('down', () => setAlarm('down', 1))
  downButton.on('hold', () => setAlarm('down', 10))

  console.log('Ready!')
}

function setAlarm (button, amount) {
  if (!alarmDismissed) {
    nextAlarm.add(button === 'up' ? shortSnooze : longSnooze, 'minutes')
  } else {
    nextAlarm.add(button === 'up' ? amount : -amount, 'minutes')
  }

  tick()
}

function updateDisplay () {
  // using piezo + display together uses too much power and causes issues
  if (pauseDisplay) return

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
  // don't change the alarm if it's currently ringing
  if (!alarmDismissed) return

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

  // gradually get brighter/dimmer 30 mins before/after alarm
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
  // beep once, then fire callback function
  piezo.play('C -', () => {
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
    // quickly set an alarm from terminal
    a (amount = 5, units = 'seconds') {
      nextAlarm = moment().add(amount, units)
    }
  })
})
