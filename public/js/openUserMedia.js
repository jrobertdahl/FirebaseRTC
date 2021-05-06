import { userMediaAudio } from "./userMediaAudio.js";

console.log(userMediaAudio);

export async function openUserMedia() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: userMediaAudio,
  });

  console.log(stream);

  return stream;
}
