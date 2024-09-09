const { SlashCommandBuilder } = require('discord.js');
const { createCanvas } = require('canvas');
const fetch = require('node-fetch');
const { GifReader } = require('omggif');
const path = require('path');
const fs = require('fs');

async function resizeGif(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const gifData = new Uint8Array(arrayBuffer);

  const gifReader = new GifReader(gifData);
  const numFrames = gifReader.numFrames();

  const resizedFrames = [];

  for (let i = 0; i < numFrames; i++) {
      const frameWidth = gifReader.frameInfo(i).width;
      const frameHeight = gifReader.frameInfo(i).height;

      const canvas = createCanvas(64, 64);
      const ctx = canvas.getContext('2d');

      const frameData = new Uint8Array(frameWidth * frameHeight * 4);
      gifReader.decodeAndBlitFrameRGBA(i, frameData);

      const imageData = ctx.createImageData(64, 64);
      for (let y = 0; y < 64; y++) {
          for (let x = 0; x < 64; x++) {
              const sx = Math.floor(x * frameWidth / 64);
              const sy = Math.floor(y * frameHeight / 64);
              const offset = (sy * frameWidth + sx) * 4;
              const baseOffset = (y * 64 + x) * 4;
              imageData.data[baseOffset] = frameData[offset];
              imageData.data[baseOffset + 1] = frameData[offset + 1];
              imageData.data[baseOffset + 2] = frameData[offset + 2];
              imageData.data[baseOffset + 3] = frameData[offset + 3];
          }
      }
      ctx.putImageData(imageData, 0, 0);

      const base64Data = getRGBBase64(canvas);

      // Debug output
      console.log(`Frame ${i} base64 data length: ${base64Data.length}`);

      resizedFrames.push(base64Data);
  }

  return resizedFrames;
}


function getRGBBase64(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;

    let rgbBuffer = Buffer.alloc(canvas.width * canvas.height * 3);
    let offset = 0;

    for (let i = 0; i < data.length; i += 4) {
        rgbBuffer.writeUInt8(data[i], offset++);     // Red
        rgbBuffer.writeUInt8(data[i + 1], offset++); // Green
        rgbBuffer.writeUInt8(data[i + 2], offset++); // Blue
    }

    return rgbBuffer.toString('base64'); 
}

async function sendResetCommand() {
    const pixooUrl = `http://${process.env.PIXOO_IP}:80/post`;

    const payload = {
        Command: 'Draw/ResetHttpGifId',
    };

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    };

    try {
        const res = await fetch(pixooUrl, options);
        const responseText = await res.text(); // Get the response body as text

        console.log(`Response Status: ${res.status}`);
        console.log(`Response Text: ${responseText}`);

        if (res.ok) {
            console.log('Reset command sent to Pixoo');
        } else {
            console.error(`Failed to send reset command to Pixoo. Status code: ${res.status}`);
        }
    } catch (err) {
        console.error(`Error sending reset command to Pixoo: ${err.message}`);
    }
}

async function sendGifToPixoo(frames, picID, picSpeed) {
    const pixooUrl = `http://${process.env.PIXOO_IP}:80/post`;

    for (let i = 0; i < frames.length; i++) {
        const payload = {
            Command: 'Draw/SendHttpGif',
            PicNum: frames.length,
            PicWidth: 64, // assuming 64x64 resolution
            PicOffset: i,
            PicID: picID,
            PicSpeed: picSpeed,
            PicData: frames[i],
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        };

        try {
            const res = await fetch(pixooUrl, options);
            const responseText = await res.text(); // Get the response body as text

            console.log(`Response Status: ${res.status}`);
            console.log(`Response Text: ${responseText}`);

            if (res.ok) {
                console.log(`Frame ${i} sent to Pixoo`);
            } else {
                console.error(`Failed to send frame ${i} to Pixoo. Status code: ${res.status}`);
            }
        } catch (err) {
            console.error(`Error sending frame ${i} to Pixoo: ${err.message}`);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gif')
        .setDescription('Send a GIF to the Pixoo device')
        .addAttachmentOption(option =>
            option.setName('gif')
                .setDescription('The GIF to process')
                .setRequired(true)),
    async execute(interaction) {
        const attachment = interaction.options.getAttachment('gif');

        if (!attachment) {
            console.log('No GIF attachment found!');
            return interaction.reply('No GIF attachment found!');
        }

        try {
            // Defer the reply, letting Discord know you'll respond later
            await interaction.deferReply();

            // Retrieve and resize the GIF
            console.log('Retrieved GIF URL:', attachment.url);
            const resizedFrames = await resizeGif(attachment.url);

            // Initialize picID and speed
            let picID = Math.floor(Math.random() * 10000); // Unique ID for this animation
            const picSpeed = 100; // Example speed in ms

            // Send reset command
            await sendResetCommand();

            // Send the resized GIF to Pixoo
            await sendGifToPixoo(resizedFrames, picID, picSpeed);

            // After processing, send the final response
            await interaction.editReply('GIF processing and sending completed.');
        } catch (error) {
            console.error('Error processing GIF:', error.message);
            await interaction.editReply('Failed to process the GIF.');
        }
    },
};
