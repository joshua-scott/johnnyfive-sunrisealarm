# johnnyfive-sunrisealarm
### An alarm clock with sunrise simulation features to prevent [Seasonal Affective Disorder](https://en.wikipedia.org/wiki/Seasonal_affective_disorder). 

Powered by an [Arduino UNO](https://store.arduino.cc/arduino-uno-rev3) and the [Johnny-Five JavaScript Robotics &amp; IOT Platform](https://github.com/rwaldron/johnny-five).

![diagram](diagram.jpg)

## Cool! What equipment do I need to build this?
Just the stuff shown in the diagram above, namely:
- Arduino UNO, or another [supported device](http://johnny-five.io/platform-support/) with minor changes to the code
- LCD display with [valid controller](http://johnny-five.io/api/lcd/)
- A potentiometer to control the display contrast
- Piezo to sound the alarm
- Breadboard
- A couple of LEDs
- A few basic resistors
- Several wires
- A steady hand and a little patience

Note that the Arduino simply acts as a 'thin client'; all the actual code is executed on a host machine running Node.js (e.g. your computer). To untether, you'll need a client that can itself run Node.js. Check the [Johnny-Five platform support](http://johnny-five.io/platform-support/#relationship:embedded) page to assess your options.

## OK, I've plugged everything in, now what?
1. Prep your board using the instructions [here](https://github.com/rwaldron/johnny-five/wiki/Getting-Started)
2. Clone this repo
3. Install the necessary dependencies with `npm install`
4. Run it with `npm start`

Note: there's a decent chance you'll have to change the port at `new five.Board({ port: 'COM3' })`. Try calling it with no arguments first, but [check here](http://johnny-five.io/api/boards/) if that doesn't work.

## Uhh, I get an error. What's up with that?
No idea, but feel free to send me an email (see profile) and I'll see if I can help.