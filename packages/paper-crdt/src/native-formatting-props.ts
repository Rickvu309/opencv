import {
  paragraphSchema,
  type ParagraphPresentation,
} from "@workspace/domain/internal/paper-presentation"
const string = { default: undefined, type: "string" } as const
const number = { default: undefined, type: "number" } as const
const boolean = { default: undefined, type: "boolean" } as const
export const formattingProps = {
  textAlignment: string,
  lineKind: string,
  lineValue: number,
  spaceBefore: number,
  spaceAfter: number,
  indentStart: number,
  indentEnd: number,
  indentKind: string,
  indentValue: number,
  keepNext: boolean,
  keepTogether: boolean,
  widowOrphan: boolean,
  paragraphStyle: string,
}
export function engineProps(p: ParagraphPresentation) {
  const checked = paragraphSchema.parse(p)
  return {
    ...(checked.alignment === undefined
      ? {}
      : { textAlignment: checked.alignment }),
    ...(checked.lineSpacing === undefined
      ? {}
      : {
          lineKind: checked.lineSpacing.kind,
          lineValue: checked.lineSpacing.value,
        }),
    ...(checked.before === undefined ? {} : { spaceBefore: checked.before }),
    ...(checked.after === undefined ? {} : { spaceAfter: checked.after }),
    ...(checked.start === undefined ? {} : { indentStart: checked.start }),
    ...(checked.end === undefined ? {} : { indentEnd: checked.end }),
    ...(checked.indent === undefined
      ? {}
      : { indentKind: checked.indent.kind, indentValue: checked.indent.value }),
    ...(checked.keepNext === undefined ? {} : { keepNext: checked.keepNext }),
    ...(checked.keepTogether === undefined
      ? {}
      : { keepTogether: checked.keepTogether }),
    ...(checked.widowOrphan === undefined
      ? {}
      : { widowOrphan: checked.widowOrphan }),
    ...(checked.paragraphStyle === undefined
      ? {}
      : { paragraphStyle: checked.paragraphStyle }),
  }
}
export function canonicalProps(
  props: Record<string, unknown>
): ParagraphPresentation {
  if (
    (props.lineKind === undefined) !== (props.lineValue === undefined) ||
    (props.indentKind === undefined) !== (props.indentValue === undefined)
  )
    throw new Error("Incomplete paragraph pair")
  return paragraphSchema.parse({
    alignment: props.textAlignment,
    before: props.spaceBefore,
    after: props.spaceAfter,
    start: props.indentStart,
    end: props.indentEnd,
    lineSpacing:
      props.lineKind === undefined
        ? undefined
        : { kind: props.lineKind, value: props.lineValue },
    indent:
      props.indentKind === undefined
        ? undefined
        : { kind: props.indentKind, value: props.indentValue },
    keepNext: props.keepNext,
    keepTogether: props.keepTogether,
    widowOrphan: props.widowOrphan,
    paragraphStyle: props.paragraphStyle,
  })
}
