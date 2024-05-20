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
    const [debouncedSearch, setDebouncedSearch] = useDebounceValue(
        search,
        1000
    );

    const [buffer, setBuffer] = useState<Message[]>([]);
    const [filteredBuffer, setFilteredBuffer] = useState<Message[]>([]);
    const [renderId, setRenderId] = useState<string>(nanoid());

    const { width: viewPortWidth } = useWindowSize();

    useEffect(() => {
        setDebouncedSearch(search);
    }, [search]);

    useEffect(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("search", debouncedSearch);
        history.pushState({}, "", url);

        if (debouncedSearch != "") {
            setFilteredBuffer(
                buffer.filter((message) =>
                    message.message.includes(debouncedSearch)
                )
            );
        } else {
            setFilteredBuffer(buffer);
        }
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
                <div className="relative flex flex-row w-full items-center gap-2 py-2">
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
                        className="text-gray-300 absolute inset-y-1/2 -translate-y-1/2 left-1 w-4 h-4"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                    </svg>
                    <input
                        type="text"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="p-1 px-6 m-0 text-base leading-tight rounded-md flex-grow min-w-0 bg-zinc-800 border border-zinc-500 text-gray-300 shadow-md ring-0 outline-0"
                        placeholder="Search..."
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
                    className="w-full flex flex-col text-white flex-grow bg-zinc-800 font-['JetBrains'] overflow-auto scrollbar-none rounded-md"
                >
                    <AutoSizer>
                        {({ height, width }) => (
                            <VariableSizeList
                                width={width}
                                height={height}
                                itemSize={() => 20}
                                itemCount={filteredBuffer.length}
                                itemData={filteredBuffer}
                                itemKey={(index, data) => data[index].id}
                                className="overflow-y-auto scrollbar-thin"
                            >
                                {({ index, style }) => {
                                    const tree = BuildRenderTree(
                                        filteredBuffer[index].message,
                                        debouncedSearch
                                    );

                                    return (
                                        <div
                                            key={filteredBuffer[index].id}
                                            style={{
                                                ...style,
                                            }}
                                            className="flex flex-row text-sm items-center w-full h-min px-2 whitespace-pre-wrap"
                                        >
                                            {tree.map((item) => {
                                                return (
                                                    <>
                                                        <span
                                                            key={item.id}
                                                            className={
                                                                item.className +
                                                                " break-all whitespace-nowrap"
                                                            }
                                                        >
                                                            {item.text.replaceAll(
                                                                " ",
                                                                "\u00a0"
                                                            )}
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
