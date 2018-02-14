const five = require('johnny-five')
const moment = require('moment')
const board = new five.Board({ port: 'COM3' })

let alarmOn = true
let keepPlaying = true
let pauseDisplay = false
let alarmTime = moment().add(1, 'hour').set({seconds: 0}) // alarm defaults to 1 hour from now

function setupHardware () {
  upButton = new five.Button({ pin: 2, holdtime: 250 })
  downButton = new five.Button({ pin: 3, holdtime: 250 })
  modeButton = new five.Button({ pin: 4, holdtime: 500 })
  sunriseLed = new five.Led(5)
  infoLed = new five.Led(6)
  piezo = new five.Piezo(7)
  lcd = new five.LCD({
    pins: [8, 9, 10, 11, 12, 13],
    rows: 2,
    cols: 20
  });
  lcd.useChar('clock');
  lcd.useChar('bell');
  
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
  if (pauseDisplay) return  // using piezo + display together uses too much power and causes issues, so pause updates during alarm

  lcd.clear().print(`:clock: ${moment().format('HH:mm:ss')}`);
  lcd.cursor(1, 0).print(`:bell: ${alarmTime.format('HH:mm:ss')}`);
  console.log(`Current time: ${moment().format('HH:mm:ss')}\tAlarm time: ${alarmTime.format('HH:mm:ss')} (${alarmTime.fromNow()})\talarmOn: ${alarmOn}`)
}

function tick () {
  showStatus()

  alarmOn ? infoLed.on() : infoLed.off()

  /* Gradually get brighter from 30 mins before alarm.
     Could have used fadeIn() here, but it's messy if user sets
     the alarm for <30 mins from now. This way is more robust. */
  const minsLeft = alarmTime.diff(moment(), 'minutes')
  if (alarmOn && minsLeft <= 30) {
    const sunlight = Math.round(((30 - minsLeft) / 30) * 255)
    sunriseLed.brightness(sunlight)
    console.log(`Sunlight: ${sunlight}/255`)
  }
  
  if (alarmOn && moment().isSame(alarmTime, 'seconds')) {
    keepPlaying = true
    pauseDisplay = true
    soundAlarm()
    alarmTime.add(1, 'day').set({seconds: 0})
  }
}

function soundAlarm () {
  piezo.play('C -', () => {
    if (keepPlaying) {
      console.log('BEEP')
      showStatus()
      soundAlarm()
    } else {
      console.log('Alarm stopped')
      pauseDisplay = false
      // Keep it sunny for 10 mins, then fade it out over 30 mins (currently 1 min for testing)
      setTimeout(() => {
        sunriseLed.fadeOut(1000/*ms*/ * 60/*secs*/ /* 30/*mins*/)
      }, 1000/*ms*/ * 60/*secs*/ /* 10/*mins*/)
    }
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
- Allow user to change alarm hour too (perhaps by tapping mode button: if there's not an alarm playing,
  we know the user wants to change the minutes/hour). Possibly flash the currentlyEditing units until a timeout?
- When alarm is sounding, consider: tap to snooze, hold to dismiss? Or use the arrow buttons? Could use the
  display as a key, if there's room
*/
