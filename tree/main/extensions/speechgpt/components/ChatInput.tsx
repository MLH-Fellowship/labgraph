"use client"
import { PaperAirplaneIcon, MicrophoneIcon } from "@heroicons/react/24/solid";
import { addDoc, getDocs, collection, serverTimestamp } from "firebase/firestore";
import { useSession } from "next-auth/react";
import { FormEvent, useState } from "react";
import { toast } from "react-hot-toast";
import { db } from "../firebase";
import ModelSelection from "./ModelSelection";
import useSWR from "swr";
import { ReactMic } from "react-mic";

type Props = {
  chatId: string;
};

function ChatInput({ chatId }: Props) {
  const [prompt, setPrompt] = useState("");
  const { data: session } = useSession();

  const { data: model, mutate: setModel } = useSWR("model", {
    fallbackData: "text-davinci-003",
  });

  const [isRecording, setIsRecording] = useState(false);

  const onRecordingStop = (recordedBlob: any) => {
    if (recordedBlob) {
      const fd = new FormData();
      fd.append("audio", recordedBlob.blob);

      fetch("/api/transcribe", {
        method: "POST",
        body: fd,
      })
        .then((response) => response.json())
        .then((data) => {
          setPrompt(data.text);
        })
        .catch((error) => console.error(error));
    } else {
      console.log("no audio data");
    }
  };

  const sendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!prompt) return;

    const input = prompt.trim();
    setPrompt("");

    const message: Message = {
      text: input,
      createdAt: serverTimestamp(),
      user: {
        _id: session?.user?.email!,
        name: session?.user?.name!,
        avatar:
          session?.user?.image! ||
          `https://ui-avatars.com/api/?name=${session?.user?.name}`,
      },
      thumbsUp: false,
      thumbsDown: false,
    };

    await addDoc(
      collection(
        db,
        "users",
        session?.user?.email!,
        "chats",
        chatId,
        "messages"
      ),
      message
    );

    const querySnapshot = await getDocs(
      collection(
        db,
        "users",
        session?.user?.email!,
        "chats",
        chatId,
        "messages"
      )
    );
    const chatHistory = querySnapshot.docs.map((doc) => doc.data());

    const notification = toast.loading("SpeechGPT is thinking...");

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
          onChange={(e) => setPrompt(e.target.value)}
          type="text"
          placeholder="Type your message here..."
        />
        <ReactMic
          record={isRecording}
          className="hidden"
          onStop={(recording) => {
            const blob = new Blob([recording.blob], { type: "audio/wav" });
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
          }}
          strokeColor="#11A37F"
          backgroundColor="#fff"
        />

        <button

          className={`${isRecording ? "text-green-500" : "text-gray-400"
            } hover:text-green-500 focus:outline-none`}
        >
          {isRecording ?
            <div className="w-6 h-6 animate-pulse">
              <svg viewBox="0 0 24 24">
                <path fill="currentColor" d="M5 12H4v2h1v-2zm2.71-5.63L6.29 6.71 4.88 5.3l1.41-1.42 1.42 1.42zm9.58-1.42L13.71 6.7l-1.42-1.42 1.41-1.41 1.42 1.41zm-6.37 6.36L7.76 8.47 6.34 9.88l2.93 2.93 1.41-1.41zM19 12h-1v2h1v-2zm-3.29 5.63l-1.42-1.42 1.41-1.41 1.42 1.41-1.41 1.42zm-2.34 2.34l-1.41 1.41-1.42-1.41 1.41-1.42 1.42 1.42zM12 19c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z" />
              </svg>
            </div> :
            <MicrophoneIcon className="w-6 h-6" />
          }
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