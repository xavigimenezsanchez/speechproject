// ------------- SETTINGS
const projectId = process.env.npm_config_PROJECT_ID;
const port = ( process.env.npm_config_PORT || 3000 );

const languageCode = 'en-UK';
let encoding = 'LINEAR16';

const singleUtterance = true;
const interimResults = false;
const sampleRateHertz = 16000;



console.log(projectId);

// ----------------------


// load all the libraries for the server
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const http = require('http');
const cors = require('cors');
const express = require('express');
const ss = require('socket.io-stream');
// load all the libraries for the Dialogflow part
const uuid = require('uuid');
const util = require('util');
const { Transform, pipeline } = require('stream');
const pump = util.promisify(pipeline);

// set some server variables
const app = express();
var server;

var speechClient, requestSTT;


const speech = require('@google-cloud/speech');


/**
 * Setup Express Server with CORS and SocketIO
 */
function setupServer() {
    // setup Express
    app.use(cors());
    app.get('/', function(req, res) {
      res.sendFile(path.join(__dirname +'/index.html'));
    });
    server = http.createServer(app);
    io = socketIo(server);
    server.listen(port, () => {
        console.log('Running server on port %s', port);
    });

    // Listener, once the client connect to the server socket
    io.on('connect', (client) => {
        console.log(`Client connected [id=${client.id}]`);
        client.emit('server_setup', `Server connected [id=${client.id}]`);

        ss(client).on('stream-transcribe', function(stream, data) {
            // get the name of the stream
            console.log(data.size);
            const filename = path.basename(data.name);
            // pipe the filename to the stream
            stream.pipe(fs.createWriteStream(filename));
            // make a detectIntStream call
            transcribeAudioStream(stream, function(results){
                console.log(results);
                client.emit('results', results);
            });
        });

    });
}

/**
 * Setup Cloud STT Integration
 */
function setupSTT(){
   // Creates a client
   speechClient = new speech.SpeechClient();

    // Create the initial request object
    // When streaming, this is the first call you will
    // make, a request without the audio stream
    // which prepares Dialogflow in receiving audio
    // with a certain sampleRateHerz, encoding and languageCode
    // this needs to be in line with the audio settings
    // that are set in the client
    requestSTT = {
      config: {
        sampleRateHertz: sampleRateHertz,
        encoding: encoding,
        languageCode: languageCode
      },
      interimResults: interimResults,
      //enableSpeakerDiarization: true,
      //diarizationSpeakerCount: 2,
      //model: `phone_call`
    }

}

 /*
  * STT - Transcribe Speech on Audio Stream
  * @param audio stream
  * @param cb Callback function to execute with results
  */
 async function transcribeAudioStream(audio, cb) { 
  const recognizeStream = speechClient.streamingRecognize(requestSTT)
            .on('data', function(data){
                console.log('siiiiiiii');
                console.log(data);
                cb(data);
            })
            .on('error', (e) => {
                console.log(e);
            })
            .on('end', () => {
                console.log('on end');
            });

  audio.pipe(recognizeStream);
  audio.on('end', function() {
      console.log('He acabat');
      //fileWriter.end();
  });
};

setupSTT();
setupServer();