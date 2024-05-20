import { useEffect, useMemo, useRef } from "react";
import debounce from "lodash.debounce";

function useUnmount(func: () => void) {
    const funcRef = useRef(func);

    funcRef.current = func;

    useEffect(
        () => () => {
            funcRef.current();
        },
        []
    );
}

type DebounceOptions = {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
};

type ControlFunctions = {
    cancel: () => void;
    flush: () => void;
    isPending: () => boolean;
};

export type DebouncedState<T extends (...args: any) => ReturnType<T>> = ((
    ...args: Parameters<T>
) => ReturnType<T> | undefined) &
    ControlFunctions;

export function useDebounceCallback<T extends (...args: any) => ReturnType<T>>(
    func: T,
    delay = 500,
    options?: DebounceOptions
): DebouncedState<T> {
    const debouncedFunc = useRef<ReturnType<typeof debounce>>();

    useUnmount(() => {
        if (debouncedFunc.current) {
            debouncedFunc.current.cancel();
        }
    });

    const debounced = useMemo(() => {
        const debouncedFuncInstance = debounce(func, delay, options);

        const wrappedFunc: DebouncedState<T> = (...args: Parameters<T>) => {
            return debouncedFuncInstance(...args);
        };

        wrappedFunc.cancel = () => {
            debouncedFuncInstance.cancel();
        };

        wrappedFunc.isPending = () => {
            return !!debouncedFunc.current;
        };

        wrappedFunc.flush = () => {
            return debouncedFuncInstance.flush();
        };

        return wrappedFunc;
    }, [func, delay, options]);

    // Update the debounced function ref whenever func, wait, or options change
    useEffect(() => {
        debouncedFunc.current = debounce(func, delay, options);
    }, [func, delay, options]);

    return debounced;
}

import { useState } from "react";

type UseDebounceValueOptions<T> = {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
    equalityFn?: (left: T, right: T) => boolean;
};

export function useDebounceValue<T>(
    initialValue: T | (() => T),
    delay: number,
    options?: UseDebounceValueOptions<T>
): [T, DebouncedState<(value: T) => void>] {
    const eq = options?.equalityFn ?? ((left: T, right: T) => left === right);
    const unwrappedInitialValue =
        initialValue instanceof Function ? initialValue() : initialValue;
    const [debouncedValue, setDebouncedValue] = useState<T>(
        unwrappedInitialValue
    );
    const previousValueRef = useRef<T | undefined>(unwrappedInitialValue);

    const updateDebouncedValue = useDebounceCallback(
        setDebouncedValue,
        delay,
        options
    );

    // Update the debounced value if the initial value changes
    if (!eq(previousValueRef.current as T, unwrappedInitialValue)) {
        updateDebouncedValue(unwrappedInitialValue);
        previousValueRef.current = unwrappedInitialValue;
    }

    return [debouncedValue, updateDebouncedValue];
}
