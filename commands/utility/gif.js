const { SlashCommandBuilder } = require('discord.js');
const { createCanvas } = require('canvas');
const fetch = require('node-fetch');
const { GifReader } = require('omggif');
const path = require('path');
const fs = require('fs');

function getRGBBase64(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
}

async function sendFrameToPixoo(base64Data, picOffset, picID, picSpeed, totalFrames) {
  const payload = {
    Command: 'Draw/SendHttpGif',
    PicNum: totalFrames,
    PicWidth: 64, // assuming 64x64 resolution
    PicOffset: picOffset,
    PicID: picID,
    PicSpeed: picSpeed,
    PicData: base64Data,
  };

  // Log the payload values for debugging
  console.log('Payload Details:');
  console.log(`Command: ${payload.Command}`);
  console.log(`PicNum: ${payload.PicNum}`);
  console.log(`PicWidth: ${payload.PicWidth}`);
  console.log(`PicOffset: ${payload.PicOffset}`);
  console.log(`PicID: ${payload.PicID}`);
  console.log(`PicSpeed: ${payload.PicSpeed}`);
  console.log(`PicData: ${payload.PicData.substring(0, 100)}...`); // Log only the start of base64 data for brevity

  const url = `http://${process.env.PIXOO_IP}:80/post`;
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  };

  try {
    const res = await fetch(url, options);
    const responseText = await res.text(); // Get the response body as text

    // Log the response details
    console.log(`Response Status: ${res.status}`);
    console.log(`Response Text: ${responseText}`);

    if (res.ok) {
      console.log(`Frame ${picOffset} sent to Pixoo` + "\n");
    } else {
      console.error(`Failed to send frame ${picOffset} to Pixoo. Status code: ${res.status}`);
    }
  } catch (err) {
    console.error(`Error sending frame ${picOffset} to Pixoo: ${err.message}`);
  }
}





let globalPicID = 1; // Initialize a global picID counter

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

      console.log('Loading GIF from URL:', attachment.url);

      const response = await fetch(attachment.url);
      const arrayBuffer = await response.arrayBuffer();
      const gifData = new Uint8Array(arrayBuffer);

      const gifReader = new GifReader(gifData);
      const numFrames = gifReader.numFrames();
      const frameWidth = gifReader.frameInfo(0).width;
      const frameHeight = gifReader.frameInfo(0).height;

      const picSpeed = 100; // Example speed in ms

      // Use the global picID for this GIF
      const currentPicID = globalPicID;

      for (let i = 0; i < numFrames; i++) {
        const canvas = createCanvas(64, 64); // Adjust dimensions as needed
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

        // Pass the current picID for all frames in this GIF
        await sendFrameToPixoo(base64Data, i, currentPicID, picSpeed, numFrames);
      }

      // Increment picID for the next GIF
      globalPicID++;

      // After processing, send the final response
      await interaction.editReply('GIF processed and sent to Pixoo successfully.');
    } catch (error) {
      console.error('Error processing GIF:', error.message);
      await interaction.editReply('Failed to process the GIF.');
    }
  },
};
