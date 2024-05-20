import { useEffect, useState } from "react";
import addToBuffer, { Message } from "./buffer";
import { useCopyToClipboard } from "./copyToClipboard";
import AutoSizer from "react-virtualized-auto-sizer";
import { VariableSizeList } from "react-window";
import { useWindowSize } from "./useWindowsResize";
import { Toaster, toast } from "sonner";
import { nanoid } from "nanoid";
import { BuildRenderTree } from "./Tree";
import { useDebounceValue } from "./useDebounce";

const maxSize = 40000;

export default function App() {
    const [search, setSearch] = useState<string>("");
    const [debouncedSearch, setDebouncedSearch] = useDebounceValue(search, 500);

    const [buffer, setBuffer] = useState<Message[]>([]);
    const [renderId, setRenderId] = useState<string>(nanoid());

    const { width: viewPortWidth } = useWindowSize();

    useEffect(() => {
        setDebouncedSearch(search);
    }, [search]);

    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("search", debouncedSearch);
        history.pushState({}, "", url);
    }, [debouncedSearch]);

    useEffect(() => {
        setRenderId(nanoid());
    }, [viewPortWidth]);

    useEffect(() => {
        const eventSource = new EventSource("/sse", {});

        eventSource.onmessage = (event) => {
            if (event.data != "") {
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
        const promise = new Promise((resolve) => {
            let result = "";

            for (let i = 0; i < buffer.length; i++) {
                result += buffer[i].message.replaceAll("\t", "    ") + "\n";
            }

            resolve(result);
        });

        toast.promise(promise, {
            loading: "Copying...",
            success: (data) => {
                copy(data as string);

                return `Copied!`;
            },
        });
    };

    return (
        <>
            <Toaster position="bottom-center" theme="dark" />
            <div className="w-screen h-screen p-1 flex flex-col gap-1 bg-zinc-900">
                <div className="flex flex-row w-full items-center gap-2 py-2">
                    <input
                        type="text"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="p-1 m-0 text-base leading-tight rounded-md flex-grow min-w-0 bg-zinc-800 border border-zinc-500 text-gray-300 shadow-md ring-0 outline-0"
                        placeholder="Search in logs..."
                    />
                    <button
                        type="button"
                        onClick={handleCopyToClipboard}
                        className="p-1 rounded-md bg-zinc-700 border border-zinc-500 text-gray-300 shadow-md"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-[20px] h-[20px]"
                        >
                            <rect
                                width="14"
                                height="14"
                                x="8"
                                y="8"
                                rx="2"
                                ry="2"
                            />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                    </button>
                </div>
                <div
                    key={renderId}
                    className="w-full flex flex-col text-white flex-grow bg-zinc-800 font-['JetBrains'] overflow-y-auto scrollbar-none rounded-md"
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
                                        fontSize * buffer[index].message.length;

                                    const height = Math.floor(
                                        (rawStringSizeTotalWidth * 1.8) /
                                            newWidth
                                    );

                                    return Math.max(20, height * fontSize);
                                }}
                                itemCount={buffer.length}
                                itemData={buffer}
                                itemKey={(index, data) => data[index].id}
                                className="overflow-y-auto scrollbar-thin"
                            >
                                {({ index, style }) => {
                                    const tree = BuildRenderTree(
                                        buffer[index].message,
                                        debouncedSearch
                                    );

                                    return (
                                        <div
                                            style={{
                                                ...style,
                                            }}
                                            className="flex flex-row text-sm items-center w-full h-min px-2 whitespace-pre-wrap"
                                        >
                                            {tree.map((item) => {
                                                if (item.text == "@@TAB@@") {
                                                    return (
                                                        <>
                                                            &nbsp;&nbsp;&nbsp;&nbsp;
                                                        </>
                                                    );
                                                }

                                                return (
                                                    <>
                                                        <span
                                                            key={item.id}
                                                            className={
                                                                item.className
                                                            }
                                                        >
                                                            {item.text}
                                                        </span>
                                                    </>
                                                );
                                            })}
                                        </div>
                                    );
                                }}
                            </VariableSizeList>
                        )}
                    </AutoSizer>
                </div>
            </div>
        </>
    );
}
