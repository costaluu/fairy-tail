import { nanoid } from "nanoid";

export type Message = {
    id: string;
    message: string;
};

const addToBuffer = (message: string, data: Message[], maxsize: number) => {
    if (data.length >= maxsize) {
        data.shift();
    }

    data.push({ id: nanoid(), message });

    return [...data];
};

export default addToBuffer;
