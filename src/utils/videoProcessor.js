const { spawn } = require("node:child_process");
const config = require("../config");

class VideoProcessor {
    constructor() {
        this.ffmpegCommand = config.ffmpeg.ffmpeg;
        this.ffprobeCommand = config.ffmpeg.ffprobe;
    }

    //Main functionalities.
    async getVideoMetadata (videoPath) {
        return new Promise((resolve , reject) => {
            const ffprobe = spawn(this.ffprobeCommand , [
                '-v','quiet',
                '-print_format', 'json',
                '-show_format', 
                '-show_streams',
                videoPath
            ]);

            let output = "";
            let errorOutput = "";

            ffprobe.stdout.on("data" , (chunk) => {
                output += chunk.toString();
            });

            ffprobe.stderr.on("data" , (chunk) => {
                errorOutput += chunk.toString();
            });

            ffprobe.on("close" , (code) => {
                if (code !== 0) {
                    reject(new Error(`FFprobe failed: ${errorOutput}`));
                    return;
                }

                try {
                    const metadata = JSON.parse(output);
                    const videoStream = metadata.streams.find(stream => stream.codec_type === "video");
                    
                    if (!videoStream) {
                        reject(new Error(`No video stream found`));
                        return;
                    }

                    resolve({
                        width: videoStream.width,
                        height: videoStream.height,
                        duration: Math.floor(parseFloat(metadata.format.duration)),
                        bitrate: metadata.format.bit_rate,
                        codec: videoStream.codec_name,
                        fps: eval(videoStream.r_frame_rate) 
                    })
                } catch(err) {
                    reject(new Error(`Failed to parse metadata: ${err.message}`));
                }
            });

            ffprobe.on("error", (err) => {
                reject(new Error(`FFprobe process error: ${err.message}`));
            });


        }); 
    }

    async generateThumbnail(videoPath , thumbnailPath , timeOffset = "00:00:05") {
        return new Promise((resolve , reject) => {
            const ffmpeg = spawn(this.ffmpegCommand , [
                '-i', videoPath, 
                '-ss' , timeOffset,
                '-vframes', '1',
                '-q:v', '2',
                '-vf', 'scale=320:240',
                thumbnailPath,
                '-y'
            ]);

            let errorOutput = "";
            ffmpeg.stderr.on("data" , (chunk) => {
                errorOutput += chunk.toString();
            });

            ffmpeg.on("close" , (code) => {
                if (code !== 0) {
                    reject(new Error(`FFmpeg thumbnail generation failed: ${errorOutput}`));
                    return;
                }
                resolve(thumbnailPath);
            });

            ffmpeg.on("error" , (error) => {
                reject(new Error(`FFmpeg process error: ${error.message}`));
            });
        })
    }

    async hasAudioStream(videoPath) {
        return new Promise((resolve, reject) => {
            const ffprobe = spawn(this.ffprobeCommand, [
                '-v', 'quiet',
                '-select_streams', 'a',
                '-show_entries', 'stream=codec_type',
                '-of', 'csv=p=0',
                videoPath
            ]);
    
            let output = '';
            ffprobe.stdout.on('data', (chunk) => {
                output += chunk.toString();
            });
    
            ffprobe.on('close', (code) => {
                resolve(output.trim() === 'audio');
            });
    
            ffprobe.on('error', (err) => {
                reject(err);
            });
        });
    }
    
    async extractAudio(videoPath , audioPath) {
        return new Promise((resolve , reject) => {
            const ffmpeg = spawn(this.ffmpegCommand, [
                '-i', videoPath,        
                '-vn',                  
                '-acodec', 'aac',       
                '-ab', '128k',          
                '-ac', '2',             
                '-ar', '44100',         
                '-f', 'adts',           
                audioPath,              
                '-y'                    
            ]);

            let errorOutput = "";

            ffmpeg.stderr.on("data" , (chunk) => {
                errorOutput += chunk.toString();
            });

            ffmpeg.on("close" , (code) => {
                if (code !== 0) {
                    reject(new Error(`Audio extraction failed: ${errorOutput}`));
                    return;
                }
                resolve(audioPath);
            });

            ffmpeg.on("error" , (error) => {
                reject(`FFmpeg process error: ${error.message}`);
            });
        });
    }

    async videoResize(videoPath , outputPath, width , height) {
        console.log(videoPath);
        console.log(outputPath);
        return new Promise((resolve , reject) => {
            const ffmpeg = spawn(this.ffmpegCommand , [
                '-i' , videoPath ,
                '-vf' , `scale=${width}:${height}`,
                '-c:v' , 'libx264',
                '-c:a' , 'aac',
                '-preset' , 'medium',
                '-crf' , '23',
                outputPath,
                '-y'
            ]);

            let errorOutput = '';

            ffmpeg.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Video resize failed: ${errorOutput}`));
                    return;
                }
                resolve(outputPath);
            });

            ffmpeg.on('error', (err) => {
                reject(new Error(`FFmpeg process error: ${err.message}`));
            });
        });
    }

    async changeFormat(videoPath, outputPath, targetFormat) {
        console.log("Converting format:", videoPath, "to", outputPath);
        
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn(this.ffmpegCommand, [
                '-i', videoPath,
                '-c', 'copy', 
                outputPath,
                '-y'
            ]);
    
            let errorOutput = '';
    
            ffmpeg.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
    
            ffmpeg.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Format conversion failed: ${errorOutput}`));
                    return;
                }
                resolve(outputPath);
            });
    
            ffmpeg.on('error', (err) => {
                reject(new Error(`FFmpeg process error: ${err.message}`));
            });
        });
    }
}

module.exports = new VideoProcessor();