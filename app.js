const five = require('johnny-five')
const j5songs = require('j5-songs')
const moment = require('moment')
const board = new five.Board({ port: 'COM3' })

const songs = [
  'beethovens-fifth', 'claxon', 'do-re-mi', 'doorbell', 'funeral-march-short', 
  'jingle-bells-short', 'mario-fanfare', 'mario-intro', 'never-gonna-give-you-up', 
  'pew-pew-pew', 'tetris-theme', 'starwars-theme'
]

let alarmOn = true
let keepPlaying = true
let alarmTime = moment().add(1, 'hour') // alarm defaults to 1 hour from now

function setupHardware () {
  led = new five.Led(13)
  upButton = new five.Button(3)
  downButton = new five.Button(2)
  modeButton = new five.Button({ pin: 4, holdtime: 1000 })
  piezo = new five.Piezo(5)
  
  // tap mode button to turn off currently playing alarm
  // playing an empty song avoids having to wait for the currently playing song to finish too
  modeButton.on('down', () => {
    keepPlaying = false
    piezo.play({song: '---'})
  })
  
  // hold mode button to toggle alarm on/off
  modeButton.on('hold', () => {
    alarmOn = !alarmOn
    console.log(`Alarm is now ${alarmOn ? 'on' : 'off'}`)
  })

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
  }
}

function soundAlarm () {
  const randomSong = songs[Math.floor(Math.random() * songs.length)]
  console.log(`Time to wake up to ${randomSong}!`)

  // Keep playing a random song until !keepPlaying (i.e. until user hits the mode button)
  piezo.play(j5songs.load(randomSong), () => {
    if (keepPlaying) soundAlarm()
    else console.log('Alarm stopped by user pressing mode button')
  })
}

board.on('ready', function () {
  setupHardware()
  setInterval(tick, 1000)
})
