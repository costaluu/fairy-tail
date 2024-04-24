import { useEffect, useState } from "react";
import addToBuffer, { Message } from "./buffer";
import { useCopyToClipboard } from "./copyToClipboard";
import { create } from "zustand";
import AutoSizer from "react-virtualized-auto-sizer";
import { VariableSizeList } from "react-window";
import { useWindowSize } from "./useWindowsResize";
import { nanoid } from "nanoid";

interface RunTimeStore {
    ignoreMessages: boolean;
    setStore: (store: Partial<RunTimeStore>) => void;
}

const useStore = create<RunTimeStore>((set) => ({
    ignoreMessages: true,
    setStore: (partialStore: Partial<RunTimeStore>) =>
        set(() => ({ ...partialStore })),
}));

const maxSize = 40000;
const CLOSE_EVENT = "!FORCE_SHUTDOWN!";

export default function App() {
    const [buffer, setBuffer] = useState<Message[]>([]);
    const [showCopied, setShowCopied] = useState<boolean>(false);
    const [renderId, setRenderId] = useState<string>(nanoid());

    const { width: viewPortWidth } = useWindowSize();

    useEffect(() => {
        setRenderId(nanoid());
    }, [viewPortWidth]);

    useEffect(() => {
        const eventSource = new EventSource("/sse", {});

        setTimeout(() => {
            const setStore = useStore.getState().setStore;

            setStore({ ignoreMessages: false });
        }, 1000 * 10);

        eventSource.onmessage = (event) => {
            const ignoreMessages = useStore.getState().ignoreMessages;

            if (ignoreMessages == false && event.data != "") {
                if (event.data == CLOSE_EVENT) {
                    console.error(
                        "Connection closed, another user is reading the logs."
                    );
                    eventSource.close();

                    return;
                }

                setBuffer(addToBuffer(event.data, buffer, maxSize));
            }
        };

        eventSource.onerror = (error) => {
            console.error("EventSource failed:", error);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, []);

    const [_, copy] = useCopyToClipboard();

    const handleCopyToClipboard = () => {
        let result = "";

        for (let i = 0; i < buffer.length; i++) {
            result += buffer[i].message + "\n";
        }
        copy(result);

        setShowCopied(true);

        setTimeout(() => {
            setShowCopied(false);
        }, 5000);
    };

    return (
        <div className="w-screen h-screen p-1 flex flex-col gap-1">
            <div className="flex flex-row gap-1 items-baseline">
                <button
                    type="button"
                    onClick={() => handleCopyToClipboard()}
                    className="bg-gray-300 max-w-max select-none text-black text-sm px-2 py-1 border border-black"
                >
                    Copy all
                </button>
                <span className="text-sm text-gray-400">
                    {showCopied == true ? "Copied!" : null}
                </span>
            </div>
            <div
                key={renderId}
                className="w-full flex flex-col text-white flex-grow bg-zinc-900"
            >
                <AutoSizer>
                    {({ height, width }) => (
                        <VariableSizeList
                            width={width}
                            height={height}
                            itemSize={(index) => {
                                const fontSize = 14;
                                const newWidth = width;

                                const rawStringSizeTotalWidth =
                                    fontSize *
                                    0.8 *
                                    buffer[index].message.length;

                                const height = Math.floor(
                                    rawStringSizeTotalWidth / newWidth
                                );

                                console.log(height);

                                return Math.max(20, height * fontSize);
                            }}
                            itemCount={buffer.length}
                            itemData={buffer}
                            itemKey={(index, data) => data[index].id}
                        >
                            {({ index, style }) => {
                                return (
                                    <div
                                        style={{
                                            ...style,
                                        }}
                                        className="flex flex-row items-center w-full h-min"
                                    >
                                        <span className="w-[50px] text-sm leading-none select-none">
                                            {index + 1}
                                        </span>
                                        <span className="text-sm leading-none">
                                            {buffer[index].message}
                                        </span>
                                    </div>
                                );
                            }}
                        </VariableSizeList>
                    )}
                </AutoSizer>
            </div>
        </div>
    );
}
