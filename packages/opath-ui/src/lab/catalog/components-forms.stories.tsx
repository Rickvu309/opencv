import type { Meta, StoryObj } from "@storybook/react-vite";
import { lazy } from "react";
import { LazyFrame } from "./lazy-frame";
const CheckboxPreview = lazy(() => import("../beui/previews/checkbox.preview").then((m) => ({ default: m.CheckboxPreview })));
const ComboboxPreview = lazy(() => import("../beui/previews/combobox.preview").then((m) => ({ default: m.ComboboxPreview })));
const InputPreview = lazy(() => import("../beui/previews/input.preview").then((m) => ({ default: m.InputPreview })));
const RadioPreview = lazy(() => import("../beui/previews/radio.preview").then((m) => ({ default: m.RadioPreview })));
const RangeSliderPreview = lazy(() => import("../beui/previews/range-slider.preview").then((m) => ({ default: m.RangeSliderPreview })));
const SelectPreview = lazy(() => import("../beui/previews/select.preview").then((m) => ({ default: m.SelectPreview })));
const SwitchPreview = lazy(() => import("../beui/previews/switch.preview").then((m) => ({ default: m.SwitchPreview })));
const WheelPickerPreview = lazy(() => import("../beui/previews/wheel-picker.preview").then((m) => ({ default: m.WheelPickerPreview })));
const Example_CalendarHeadless = lazy(() => import("../kibo/_examples/calendar-headless").then((m) => ({ default: m.default ?? m.Example_CalendarHeadless ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Calendar = lazy(() => import("../kibo/_examples/calendar").then((m) => ({ default: m.default ?? m.Example_Calendar ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ChoiceboxInline = lazy(() => import("../kibo/_examples/choicebox-inline").then((m) => ({ default: m.default ?? m.Example_ChoiceboxInline ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Choicebox = lazy(() => import("../kibo/_examples/choicebox").then((m) => ({ default: m.default ?? m.Example_Choicebox ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ColorPicker = lazy(() => import("../kibo/_examples/color-picker").then((m) => ({ default: m.default ?? m.Example_ColorPicker ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ComboboxControlled = lazy(() => import("../kibo/_examples/combobox-controlled").then((m) => ({ default: m.default ?? m.Example_ComboboxControlled ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ComboboxCreateNew = lazy(() => import("../kibo/_examples/combobox-create-new").then((m) => ({ default: m.default ?? m.Example_ComboboxCreateNew ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ComboboxFixedWidth = lazy(() => import("../kibo/_examples/combobox-fixed-width").then((m) => ({ default: m.default ?? m.Example_ComboboxFixedWidth ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Combobox = lazy(() => import("../kibo/_examples/combobox").then((m) => ({ default: m.default ?? m.Example_Combobox ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CreditCardAmex = lazy(() => import("../kibo/_examples/credit-card-amex").then((m) => ({ default: m.default ?? m.Example_CreditCardAmex ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CreditCardApple = lazy(() => import("../kibo/_examples/credit-card-apple").then((m) => ({ default: m.default ?? m.Example_CreditCardApple ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CreditCardBack = lazy(() => import("../kibo/_examples/credit-card-back").then((m) => ({ default: m.default ?? m.Example_CreditCardBack ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_CreditCard = lazy(() => import("../kibo/_examples/credit-card").then((m) => ({ default: m.default ?? m.Example_CreditCard ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_DropzoneAccept = lazy(() => import("../kibo/_examples/dropzone-accept").then((m) => ({ default: m.default ?? m.Example_DropzoneAccept ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_DropzoneCustomEmptyState = lazy(() => import("../kibo/_examples/dropzone-custom-empty-state").then((m) => ({ default: m.default ?? m.Example_DropzoneCustomEmptyState ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_DropzoneImagePreview = lazy(() => import("../kibo/_examples/dropzone-image-preview").then((m) => ({ default: m.default ?? m.Example_DropzoneImagePreview ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_DropzoneMinMax = lazy(() => import("../kibo/_examples/dropzone-min-max").then((m) => ({ default: m.default ?? m.Example_DropzoneMinMax ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_DropzoneMultiple = lazy(() => import("../kibo/_examples/dropzone-multiple").then((m) => ({ default: m.default ?? m.Example_DropzoneMultiple ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Dropzone = lazy(() => import("../kibo/_examples/dropzone").then((m) => ({ default: m.default ?? m.Example_Dropzone ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Editor = lazy(() => import("../kibo/_examples/editor").then((m) => ({ default: m.default ?? m.Example_Editor ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Form = lazy(() => import("../kibo/_examples/form").then((m) => ({ default: m.default ?? m.Example_Form ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ImageCropCircular = lazy(() => import("../kibo/_examples/image-crop-circular").then((m) => ({ default: m.default ?? m.Example_ImageCropCircular ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ImageCropCustom = lazy(() => import("../kibo/_examples/image-crop-custom").then((m) => ({ default: m.default ?? m.Example_ImageCropCustom ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_ImageCrop = lazy(() => import("../kibo/_examples/image-crop").then((m) => ({ default: m.default ?? m.Example_ImageCrop ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_MiniCalendarControlled = lazy(() => import("../kibo/_examples/mini-calendar-controlled").then((m) => ({ default: m.default ?? m.Example_MiniCalendarControlled ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_MiniCalendarCustom = lazy(() => import("../kibo/_examples/mini-calendar-custom").then((m) => ({ default: m.default ?? m.Example_MiniCalendarCustom ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_MiniCalendarDays = lazy(() => import("../kibo/_examples/mini-calendar-days").then((m) => ({ default: m.default ?? m.Example_MiniCalendarDays ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_MiniCalendar = lazy(() => import("../kibo/_examples/mini-calendar").then((m) => ({ default: m.default ?? m.Example_MiniCalendar ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_RatingColors = lazy(() => import("../kibo/_examples/rating-colors").then((m) => ({ default: m.default ?? m.Example_RatingColors ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_RatingControlled = lazy(() => import("../kibo/_examples/rating-controlled").then((m) => ({ default: m.default ?? m.Example_RatingControlled ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_RatingIcon = lazy(() => import("../kibo/_examples/rating-icon").then((m) => ({ default: m.default ?? m.Example_RatingIcon ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_RatingSize = lazy(() => import("../kibo/_examples/rating-size").then((m) => ({ default: m.default ?? m.Example_RatingSize ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Rating = lazy(() => import("../kibo/_examples/rating").then((m) => ({ default: m.default ?? m.Example_Rating ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_TagsCreate = lazy(() => import("../kibo/_examples/tags-create").then((m) => ({ default: m.default ?? m.Example_TagsCreate ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_TagsFilter = lazy(() => import("../kibo/_examples/tags-filter").then((m) => ({ default: m.default ?? m.Example_TagsFilter ?? Object.values(m).find((v) => typeof v === "function") })));
const Example_Tags = lazy(() => import("../kibo/_examples/tags").then((m) => ({ default: m.default ?? m.Example_Tags ?? Object.values(m).find((v) => typeof v === "function") })));

const meta = { title: "Lab/Components/Forms" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeuiCheckbox: Story = {
  name: "checkbox",
  render: () => (
    <LazyFrame width={560}>
      <CheckboxPreview />
    </LazyFrame>
  ),
};

export const BeuiCombobox: Story = {
  name: "combobox",
  render: () => (
    <LazyFrame width={560}>
      <ComboboxPreview />
    </LazyFrame>
  ),
};

export const BeuiInput: Story = {
  name: "input",
  render: () => (
    <LazyFrame width={560}>
      <InputPreview />
    </LazyFrame>
  ),
};

export const BeuiRadio: Story = {
  name: "radio",
  render: () => (
    <LazyFrame width={560}>
      <RadioPreview />
    </LazyFrame>
  ),
};

export const BeuiRangeSlider: Story = {
  name: "range slider",
  render: () => (
    <LazyFrame width={560}>
      <RangeSliderPreview />
    </LazyFrame>
  ),
};

export const BeuiSelect: Story = {
  name: "select",
  render: () => (
    <LazyFrame width={560}>
      <SelectPreview />
    </LazyFrame>
  ),
};

export const BeuiSwitch: Story = {
  name: "switch",
  render: () => (
    <LazyFrame width={560}>
      <SwitchPreview />
    </LazyFrame>
  ),
};

export const BeuiWheelPicker: Story = {
  name: "wheel picker",
  render: () => (
    <LazyFrame width={560}>
      <WheelPickerPreview />
    </LazyFrame>
  ),
};

export const KiboCalendarHeadless: Story = {
  name: "calendar headless",
  render: () => (
    <LazyFrame width={720}>
      <Example_CalendarHeadless />
    </LazyFrame>
  ),
};

export const KiboCalendar: Story = {
  name: "calendar",
  render: () => (
    <LazyFrame width={720}>
      <Example_Calendar />
    </LazyFrame>
  ),
};

export const KiboChoiceboxInline: Story = {
  name: "choicebox inline",
  render: () => (
    <LazyFrame width={720}>
      <Example_ChoiceboxInline />
    </LazyFrame>
  ),
};

export const KiboChoicebox: Story = {
  name: "choicebox",
  render: () => (
    <LazyFrame width={720}>
      <Example_Choicebox />
    </LazyFrame>
  ),
};

export const KiboColorPicker: Story = {
  name: "color picker",
  render: () => (
    <LazyFrame width={720}>
      <Example_ColorPicker />
    </LazyFrame>
  ),
};

export const KiboComboboxControlled: Story = {
  name: "combobox controlled",
  render: () => (
    <LazyFrame width={720}>
      <Example_ComboboxControlled />
    </LazyFrame>
  ),
};

export const KiboComboboxCreateNew: Story = {
  name: "combobox create new",
  render: () => (
    <LazyFrame width={720}>
      <Example_ComboboxCreateNew />
    </LazyFrame>
  ),
};

export const KiboComboboxFixedWidth: Story = {
  name: "combobox fixed width",
  render: () => (
    <LazyFrame width={720}>
      <Example_ComboboxFixedWidth />
    </LazyFrame>
  ),
};

export const KiboCombobox: Story = {
  name: "combobox",
  render: () => (
    <LazyFrame width={720}>
      <Example_Combobox />
    </LazyFrame>
  ),
};

export const KiboCreditCardAmex: Story = {
  name: "credit card amex",
  render: () => (
    <LazyFrame width={720}>
      <Example_CreditCardAmex />
    </LazyFrame>
  ),
};

export const KiboCreditCardApple: Story = {
  name: "credit card apple",
  render: () => (
    <LazyFrame width={720}>
      <Example_CreditCardApple />
    </LazyFrame>
  ),
};

export const KiboCreditCardBack: Story = {
  name: "credit card back",
  render: () => (
    <LazyFrame width={720}>
      <Example_CreditCardBack />
    </LazyFrame>
  ),
};

export const KiboCreditCard: Story = {
  name: "credit card",
  render: () => (
    <LazyFrame width={720}>
      <Example_CreditCard />
    </LazyFrame>
  ),
};

export const KiboDropzoneAccept: Story = {
  name: "dropzone accept",
  render: () => (
    <LazyFrame width={720}>
      <Example_DropzoneAccept />
    </LazyFrame>
  ),
};

export const KiboDropzoneCustomEmptyState: Story = {
  name: "dropzone custom empty state",
  render: () => (
    <LazyFrame width={720}>
      <Example_DropzoneCustomEmptyState />
    </LazyFrame>
  ),
};

export const KiboDropzoneImagePreview: Story = {
  name: "dropzone image preview",
  render: () => (
    <LazyFrame width={720}>
      <Example_DropzoneImagePreview />
    </LazyFrame>
  ),
};

export const KiboDropzoneMinMax: Story = {
  name: "dropzone min max",
  render: () => (
    <LazyFrame width={720}>
      <Example_DropzoneMinMax />
    </LazyFrame>
  ),
};

export const KiboDropzoneMultiple: Story = {
  name: "dropzone multiple",
  render: () => (
    <LazyFrame width={720}>
      <Example_DropzoneMultiple />
    </LazyFrame>
  ),
};

export const KiboDropzone: Story = {
  name: "dropzone",
  render: () => (
    <LazyFrame width={720}>
      <Example_Dropzone />
    </LazyFrame>
  ),
};

export const KiboEditor: Story = {
  name: "editor",
  render: () => (
    <LazyFrame width={720}>
      <Example_Editor />
    </LazyFrame>
  ),
};

export const KiboForm: Story = {
  name: "form",
  render: () => (
    <LazyFrame width={720}>
      <Example_Form />
    </LazyFrame>
  ),
};

export const KiboImageCropCircular: Story = {
  name: "image crop circular",
  render: () => (
    <LazyFrame width={720}>
      <Example_ImageCropCircular />
    </LazyFrame>
  ),
};

export const KiboImageCropCustom: Story = {
  name: "image crop custom",
  render: () => (
    <LazyFrame width={720}>
      <Example_ImageCropCustom />
    </LazyFrame>
  ),
};

export const KiboImageCrop: Story = {
  name: "image crop",
  render: () => (
    <LazyFrame width={720}>
      <Example_ImageCrop />
    </LazyFrame>
  ),
};

export const KiboMiniCalendarControlled: Story = {
  name: "mini calendar controlled",
  render: () => (
    <LazyFrame width={720}>
      <Example_MiniCalendarControlled />
    </LazyFrame>
  ),
};

export const KiboMiniCalendarCustom: Story = {
  name: "mini calendar custom",
  render: () => (
    <LazyFrame width={720}>
      <Example_MiniCalendarCustom />
    </LazyFrame>
  ),
};

export const KiboMiniCalendarDays: Story = {
  name: "mini calendar days",
  render: () => (
    <LazyFrame width={720}>
      <Example_MiniCalendarDays />
    </LazyFrame>
  ),
};

export const KiboMiniCalendar: Story = {
  name: "mini calendar",
  render: () => (
    <LazyFrame width={720}>
      <Example_MiniCalendar />
    </LazyFrame>
  ),
};

export const KiboRatingColors: Story = {
  name: "rating colors",
  render: () => (
    <LazyFrame width={720}>
      <Example_RatingColors />
    </LazyFrame>
  ),
};

export const KiboRatingControlled: Story = {
  name: "rating controlled",
  render: () => (
    <LazyFrame width={720}>
      <Example_RatingControlled />
    </LazyFrame>
  ),
};

export const KiboRatingIcon: Story = {
  name: "rating icon",
  render: () => (
    <LazyFrame width={720}>
      <Example_RatingIcon />
    </LazyFrame>
  ),
};

export const KiboRatingSize: Story = {
  name: "rating size",
  render: () => (
    <LazyFrame width={720}>
      <Example_RatingSize />
    </LazyFrame>
  ),
};

export const KiboRating: Story = {
  name: "rating",
  render: () => (
    <LazyFrame width={720}>
      <Example_Rating />
    </LazyFrame>
  ),
};

export const KiboTagsCreate: Story = {
  name: "tags create",
  render: () => (
    <LazyFrame width={720}>
      <Example_TagsCreate />
    </LazyFrame>
  ),
};

export const KiboTagsFilter: Story = {
  name: "tags filter",
  render: () => (
    <LazyFrame width={720}>
      <Example_TagsFilter />
    </LazyFrame>
  ),
};

export const KiboTags: Story = {
  name: "tags",
  render: () => (
    <LazyFrame width={720}>
      <Example_Tags />
    </LazyFrame>
  ),
};
