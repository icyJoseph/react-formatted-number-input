import {
  ComponentType,
  FormEvent,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  SetStateAction,
} from "react";

type VoidCallback<Value> = (value: Value) => void;

const useIsomorphicEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function useStateWithCallback<Value>(init: Value | (() => Value)) {
  const [state, setState] = useState<Value>(init);
  const ref = useRef<VoidCallback<Value>[]>([]);
  const stateRef = useRef(() => state);
  stateRef.current = () => state;

  const setter = useCallback(
    (next: SetStateAction<Value>, callback?: VoidCallback<Value>) => {
      setState(next);

      // We could skip this if check
      if (!callback) return;

      if (ref.current.indexOf(callback) === -1) {
        ref.current.push(callback);
      }
    },
    []
  );

  useIsomorphicEffect(() => {
    const update = stateRef.current();
    ref.current.forEach((cb) => cb(update));
    ref.current = [];
  }, [state]);

  return [state, setter] as const;
}

export interface Props {
  value?: number;
  onChange: (value?: number) => void;
}

export interface State {
  formattedValue: string;
}

export interface Options {
  decimalSeparator: string;
  thousandSeparator: string;
  precision: number;
  allowNegativeValues: boolean;
}

const defaults: Options = {
  decimalSeparator: ",",
  thousandSeparator: " ",
  precision: 2,
  allowNegativeValues: false,
};

export function createFormattedNumberInput<ExternalProps>(
  InputComponent: any,
  options: Partial<Options> = {}
): ComponentType<ExternalProps | Props> {
  const opts: Options = {
    ...defaults,
    ...options,
  };

  const parse = (value: string) => {
    if (value) {
      const cleaned = value
        .replace(/\s/g, "")
        .replace(new RegExp(opts.decimalSeparator), ".");

      const number = parseFloat(cleaned);

      return !isNaN(number) ? number : undefined;
    }
  };

  const format = (value: string) => {
    value = value.replace(
      opts.allowNegativeValues ? /[^\d.,-]/g : /[^\d.,]/g,
      ""
    );

    // only keep the first decimal separator
    value = value
      .replace(/[.,]/, "_")
      .replace(/[.,]/g, "")
      .replace(/_/, opts.decimalSeparator);

    // only keep `opts.precision` fraction digits
    if (value.indexOf(opts.decimalSeparator) !== -1) {
      const [integer, fractional] = value.split(opts.decimalSeparator);
      value =
        integer + opts.decimalSeparator + fractional.substr(0, opts.precision);
    }

    // separate thousands
    value = value.replace(/\B(?=(\d{3})+(?!\d))/g, opts.thousandSeparator);

    return value;
  };

  const FormattedNumberInput = (props: Props & ExternalProps) => {
    const { value: incomingValue, onChange } = props;

    const onChangeRef = useRef<Props["onChange"]>(props.onChange);

    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    const [formattedValue, setFormattedValue] = useStateWithCallback("");

    const ref = useRef<HTMLInputElement>(null);
    const caretPosition = useRef<number>(0);

    useIsomorphicEffect(() => {
      if (ref.current) {
        ref.current.setSelectionRange(
          caretPosition.current,
          caretPosition.current
        );
      }
    }, [incomingValue]);

    const nextFormattedValue = format(String(incomingValue));
    const prevFormattedValueWithoutSpecialCharacters = formattedValue
      .replace(new RegExp(`${opts.decimalSeparator}0$`), "")
      .replace(new RegExp(`[${opts.decimalSeparator}-]`), "");

    useIsomorphicEffect(() => {
      if (nextFormattedValue !== prevFormattedValueWithoutSpecialCharacters) {
        setFormattedValue(nextFormattedValue);
      }
    }, [nextFormattedValue, prevFormattedValueWithoutSpecialCharacters]);

    const handleChange = useCallback((event: FormEvent<HTMLInputElement>) => {
      const inputted = event.currentTarget.value;
      const formatted = format(inputted);
      const delta = formatted.length - inputted.length;

      caretPosition.current =
        ref.current && ref.current.selectionEnd
          ? Math.max(ref.current.selectionEnd + delta, 0)
          : 0;

      setFormattedValue(formatted, () => onChangeRef.current(parse(formatted)));
    }, []);

    return (
      <InputComponent
        {...props}
        ref={ref}
        value={formattedValue}
        onChange={handleChange}
      />
    );
  };

  return FormattedNumberInput;
}
