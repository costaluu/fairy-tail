import { nanoid } from "nanoid";

export interface TreeItem {
    id: string;
    className: string;
    text: string;
}

interface StringRegexAction {
    className: string;
    regex: RegExp;
}

const TreeRules: StringRegexAction[] = [
    {
        className: "text-blue-500",
        regex: /((\d+[-|\/]\d+[-|\/]\d+\s\d\d?:\d\d?:\d\d?)|info)/gim,
    },
    {
        className: "text-cyan-500",
        regex: /notice/gim,
    },
    {
        className: "text-green-500",
        regex: /running|sucess|starting|ok|completed?/gim,
    },
    {
        className: "text-amber-500",
        regex: /Notification/gim,
    },
    {
        className: "text-pink-500",
        regex: /(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])/gim,
    },
    {
        className: "text-yellow-500",
        regex: /warning/gim,
    },
    {
        className: "text-red-500",
        regex: /error|fail|problem|issue/gim,
    },
    {
        className: "",
        regex: /.*/gim,
    },
];

function splitStringByRegex(
    input: string,
    regex: RegExp
): [string, string, string] | null {
    const match = new RegExp(regex).exec(input);

    if (!match || match.index === undefined) {
        return null;
    }

    const beforeMatch = input.slice(0, match.index);
    const matchedString = match[0];
    const afterMatch = input.slice(match.index + matchedString.length);

    return [beforeMatch, matchedString, afterMatch];
}

export const BuildRenderTree = (
    text: string,
    searchTerm: string
): TreeItem[] => {
    if (text == "") {
        return [{ id: nanoid(), className: "", text: "" }];
    }

    let tree: TreeItem[] = [];

    if (searchTerm != "") {
        let strings = splitStringByRegex(
            text,
            new RegExp(`${searchTerm}`, "gmi")
        );

        if (strings != null) {
            return [
                ...BuildRenderTree(strings[0], searchTerm),
                {
                    id: nanoid(),
                    className: "bg-yellow-500/50 font-semibold",
                    text: strings[1],
                },
                ...BuildRenderTree(strings[2], searchTerm),
            ];
        }
    }

    for (let i = 0; i < TreeRules.length; i++) {
        let strings = splitStringByRegex(text, TreeRules[i].regex);

        if (strings != null) {
            tree.push(
                ...BuildRenderTree(strings[0], searchTerm),
                {
                    id: nanoid(),
                    className: TreeRules[i].className,
                    text: strings[1],
                },
                ...BuildRenderTree(strings[2], searchTerm)
            );

            break;
        }
    }

    return tree.filter((node) => node.text != "");
};
