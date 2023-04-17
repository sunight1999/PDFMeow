const { ipcRenderer } = require('electron');
const fs = require('fs');

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const dependency of ['chrome', 'node', 'electron']) {
        replaceText(`${dependency}-version`, process.versions[dependency])
    }
})

ipcRenderer.on('SET_SOURCE', async (event, sourceId) => {
    try {
        console.log(sourceId)
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sourceId,
                    minWidth: 1920,
                    maxWidth: 3840,
                    minHeight: 1080,
                    maxHeight: 2160
                }
            }
        });

        handleStream(stream);
    } catch (e) {
        handleError(e)
    }
});

let index = 0;
function handleStream(stream) {
    let video = document.createElement('video');
    video.style.cssText = 'position:absolute;top:-10000px;left:-10000px;';

    video.onloadedmetadata = () => {
        video.style.width = '1920px';
        video.style.height = '1080px';

        video.play();

        var canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;

        var ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 이미지 저장
        var raw = canvas.toDataURL('image/png');
        // var link = document.createElement('a');
        // link.setAttribute('download', 'meow_' + index++ + '.png');
        // link.setAttribute('href', img);
        // link.click();
        
        //window.location.href = img;
        var data = raw.replace(/^data:image\/\w+;base64,/, "");
        var buf = Buffer.from(data, 'base64');
        fs.writeFile('meow_' + ++index + '.png', buf, err => {
            if (err)
                console.log('meow_' + ++index + '.png failed.', err);
            else
                console.log('meow_' + ++index + '.png saved.');
        });

        video.remove();

        try {
            // Destroy connect to stream
            stream.getTracks()[0].stop();
        } catch (e) {
            console.log(e);
        }
    }

    video.srcObject = stream
    document.body.appendChild(video);
}

function handleError(e) {
    console.log(e)
}