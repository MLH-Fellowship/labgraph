"use client";

import { PaperAirplaneIcon, MicrophoneIcon } from "@heroicons/react/24/solid";
import { addDoc, getDocs, collection, serverTimestamp } from "firebase/firestore";
import { useSession } from "next-auth/react";
import { FormEvent, useState, useRef } from "react";
import { toast } from "react-hot-toast";
import { db } from "../firebase";
import ModelSelection from "./ModelSelection";
import useSWR from "swr"
import { AudioRecorder } from 'audio-recorder-polyfill';
import { WavHeader, WavBuilder } from 'lamejs';
import toWav from 'audiobuffer-to-wav';


type Props = {
  chatId: string;
};

function ChatInput({ chatId }: Props) {
  const [prompt, setPrompt] = useState("");
  const { data: session } = useSession();


  const { data: model, mutate: setModel } = useSWR("model", {
    fallbackData: "text-davinci-003"
  })


  const [isRecording, setIsRecording] = useState(false);
  const [audioData, setAudioData] = useState(null);

  const handleMicrophoneClick = () => {
    if (!isRecording) {
      console.log("Recording...")
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          const chunks = [];
          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorder.start();
          setTimeout(() => {
            mediaRecorder.stop();
            setIsRecording(false);
          }, 5000); // Stop recording after 5 seconds

          mediaRecorder.addEventListener("dataavailable", (event) => {
            chunks.push(event.data);
            console.log("chunk", chunks);
          });

          mediaRecorder.addEventListener("stop", () => {
            const blob = new Blob(chunks);
            console.log("blob", blob)
            const url = URL.createObjectURL(blob);
            setAudioData({ blob, url });



            if (blob) {
              const fd = new FormData();
              fd.append('audio', blob);

              fetch("/api/transcribe", {
                method: "POST",
                body: fd,
              })
                .then(response => response.json())
                .then(data => {
                  setPrompt(data.text);
                })
                .catch(error => console.error(error));

            } else {
              console.log("no audio data")
            }


            // setTimeout(() => {
            //   handleSend()
            // }, 10000);

          });
        })
        .catch((error) => {
          console.error(error);
        });
    }
    setIsRecording(!isRecording);
  };

  const handleSend = async () => {
    console.log(audioData)

    if (audioData) {
      const fd = new FormData();
      fd.append('audio', audioData.blob);

      fetch("/api/transcribe", {
        method: "POST",
        body: fd,
      })
        .then(response => response.json())
        .then(data => {
          setPrompt(data.text);
        })
        .catch(error => console.error(error));

    } else {
      console.log("no audio data")
    }

  };


  const sendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!prompt) return;

    const input = prompt.trim();
    setPrompt("");

    const message: Message = {
      text: input,
      createdAt: serverTimestamp(),
      user: {
        _id: session?.user?.email!,
        name: session?.user?.name!,
        avatar: session?.user?.image! || `https://ui-avatars.com/api/?name=${session?.user?.name}`,
      },
      thumbsUp: false,
      thumbsDown: false
    }

    await addDoc(
      collection(db, 'users', session?.user?.email!, 'chats', chatId, 'messages'),
      message
    )



    // Query the Firebase database to get all messages for this chat
    const querySnapshot = await (await getDocs(collection(db, 'users', session?.user?.email!, 'chats', chatId, 'messages')))

    const chatHistory = querySnapshot.docs.map(doc => doc.data());
    console.log("Snapshot", querySnapshot)

    const notification = toast.loading('SpeechGPT is thinking...');

    await fetch("/api/askQuestion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: input,
        chatId,
        model,
        chatHistory,
        session,
      }),
    }).then(() => {
      // Toast notification to say sucessful!
      toast.success("SpeechGPT has responded!", {
        id: notification,
      });
    });
  };

  return (
    <div className="text-sm text-gray-400 rounded-lg bg-gray-700/50">
      <form onSubmit={sendMessage} className="flex p-5 space-x-5">
        <input
          className="flex-1 bg-transparent focus:outline-none disabled:cursor-not-allowed disabled:text-gray-300"
          disabled={!session}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          type="text" placeholder="Type your message here..."
        />

        <button
          onClick={handleMicrophoneClick}
          className={`${isRecording ? "text-green-500" : "text-gray-400"
            } hover:text-green-500 focus:outline-none`}
        >
          <MicrophoneIcon className="w-6 h-6" />
        </button>

        <button disabled={!prompt || !session} type="submit"
          className="bg-[#11A37F] hover:opacity-50 text-white font-bold
          px-4 py-2 rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <PaperAirplaneIcon className="w-4 h-4 -rotate-45" />
        </button>
      </form>

      <div>
        <div className="md:hidden">
          <ModelSelection></ModelSelection>
        </div>
      </div>
    </div>
  )
}

export default ChatInput