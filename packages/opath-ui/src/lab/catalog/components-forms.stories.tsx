import type { Meta, StoryObj } from "@storybook/react-vite";
import { StoryFrame } from "../story-frame";
import { CheckboxPreview } from "../beui/previews/checkbox.preview";
import { ComboboxPreview } from "../beui/previews/combobox.preview";
import { InputPreview } from "../beui/previews/input.preview";
import { RadioPreview } from "../beui/previews/radio.preview";
import { RangeSliderPreview } from "../beui/previews/range-slider.preview";
import { SelectPreview } from "../beui/previews/select.preview";
import { SwitchPreview } from "../beui/previews/switch.preview";
import { WheelPickerPreview } from "../beui/previews/wheel-picker.preview";
import Example_CalendarHeadless from "../kibo/_examples/calendar-headless";
import Example_Calendar from "../kibo/_examples/calendar";
import Example_ChoiceboxInline from "../kibo/_examples/choicebox-inline";
import Example_Choicebox from "../kibo/_examples/choicebox";
import Example_ColorPicker from "../kibo/_examples/color-picker";
import Example_ComboboxControlled from "../kibo/_examples/combobox-controlled";
import Example_ComboboxCreateNew from "../kibo/_examples/combobox-create-new";
import Example_ComboboxFixedWidth from "../kibo/_examples/combobox-fixed-width";
import Example_Combobox from "../kibo/_examples/combobox";
import Example_CreditCardAmex from "../kibo/_examples/credit-card-amex";
import Example_CreditCardApple from "../kibo/_examples/credit-card-apple";
import Example_CreditCardBack from "../kibo/_examples/credit-card-back";
import Example_CreditCard from "../kibo/_examples/credit-card";
import Example_DropzoneAccept from "../kibo/_examples/dropzone-accept";
import Example_DropzoneCustomEmptyState from "../kibo/_examples/dropzone-custom-empty-state";
import Example_DropzoneImagePreview from "../kibo/_examples/dropzone-image-preview";
import Example_DropzoneMinMax from "../kibo/_examples/dropzone-min-max";
import Example_DropzoneMultiple from "../kibo/_examples/dropzone-multiple";
import Example_Dropzone from "../kibo/_examples/dropzone";
import Example_Editor from "../kibo/_examples/editor";
import Example_Form from "../kibo/_examples/form";
import Example_ImageCropCircular from "../kibo/_examples/image-crop-circular";
import Example_ImageCropCustom from "../kibo/_examples/image-crop-custom";
import Example_ImageCrop from "../kibo/_examples/image-crop";
import Example_MiniCalendarControlled from "../kibo/_examples/mini-calendar-controlled";
import Example_MiniCalendarCustom from "../kibo/_examples/mini-calendar-custom";
import Example_MiniCalendarDays from "../kibo/_examples/mini-calendar-days";
import Example_MiniCalendar from "../kibo/_examples/mini-calendar";
import Example_RatingColors from "../kibo/_examples/rating-colors";
import Example_RatingControlled from "../kibo/_examples/rating-controlled";
import Example_RatingIcon from "../kibo/_examples/rating-icon";
import Example_RatingSize from "../kibo/_examples/rating-size";
import Example_Rating from "../kibo/_examples/rating";
import Example_TagsCreate from "../kibo/_examples/tags-create";
import Example_TagsFilter from "../kibo/_examples/tags-filter";
import Example_Tags from "../kibo/_examples/tags";

const meta = { title: "Lab/Components/Forms" } satisfies Meta;
export default meta;
type Story = StoryObj;

export const BeuiCheckbox: Story = {
  name: "checkbox",
  render: () => (
    <StoryFrame width={560}>
      <CheckboxPreview />
    </StoryFrame>
  ),
};

export const BeuiCombobox: Story = {
  name: "combobox",
  render: () => (
    <StoryFrame width={560}>
      <ComboboxPreview />
    </StoryFrame>
  ),
};

export const BeuiInput: Story = {
  name: "input",
  render: () => (
    <StoryFrame width={560}>
      <InputPreview />
    </StoryFrame>
  ),
};

export const BeuiRadio: Story = {
  name: "radio",
  render: () => (
    <StoryFrame width={560}>
      <RadioPreview />
    </StoryFrame>
  ),
};

export const BeuiRangeSlider: Story = {
  name: "range slider",
  render: () => (
    <StoryFrame width={560}>
      <RangeSliderPreview />
    </StoryFrame>
  ),
};

export const BeuiSelect: Story = {
  name: "select",
  render: () => (
    <StoryFrame width={560}>
      <SelectPreview />
    </StoryFrame>
  ),
};

export const BeuiSwitch: Story = {
  name: "switch",
  render: () => (
    <StoryFrame width={560}>
      <SwitchPreview />
    </StoryFrame>
  ),
};

export const BeuiWheelPicker: Story = {
  name: "wheel picker",
  render: () => (
    <StoryFrame width={560}>
      <WheelPickerPreview />
    </StoryFrame>
  ),
};

export const KiboCalendarHeadless: Story = {
  name: "calendar headless",
  render: () => (
    <StoryFrame width={720}>
      <Example_CalendarHeadless />
    </StoryFrame>
  ),
};

export const KiboCalendar: Story = {
  name: "calendar",
  render: () => (
    <StoryFrame width={720}>
      <Example_Calendar />
    </StoryFrame>
  ),
};

export const KiboChoiceboxInline: Story = {
  name: "choicebox inline",
  render: () => (
    <StoryFrame width={720}>
      <Example_ChoiceboxInline />
    </StoryFrame>
  ),
};

export const KiboChoicebox: Story = {
  name: "choicebox",
  render: () => (
    <StoryFrame width={720}>
      <Example_Choicebox />
    </StoryFrame>
  ),
};

export const KiboColorPicker: Story = {
  name: "color picker",
  render: () => (
    <StoryFrame width={720}>
      <Example_ColorPicker />
    </StoryFrame>
  ),
};

export const KiboComboboxControlled: Story = {
  name: "combobox controlled",
  render: () => (
    <StoryFrame width={720}>
      <Example_ComboboxControlled />
    </StoryFrame>
  ),
};

export const KiboComboboxCreateNew: Story = {
  name: "combobox create new",
  render: () => (
    <StoryFrame width={720}>
      <Example_ComboboxCreateNew />
    </StoryFrame>
  ),
};

export const KiboComboboxFixedWidth: Story = {
  name: "combobox fixed width",
  render: () => (
    <StoryFrame width={720}>
      <Example_ComboboxFixedWidth />
    </StoryFrame>
  ),
};

export const KiboCombobox: Story = {
  name: "combobox",
  render: () => (
    <StoryFrame width={720}>
      <Example_Combobox />
    </StoryFrame>
  ),
};

export const KiboCreditCardAmex: Story = {
  name: "credit card amex",
  render: () => (
    <StoryFrame width={720}>
      <Example_CreditCardAmex />
    </StoryFrame>
  ),
};

export const KiboCreditCardApple: Story = {
  name: "credit card apple",
  render: () => (
    <StoryFrame width={720}>
      <Example_CreditCardApple />
    </StoryFrame>
  ),
};

export const KiboCreditCardBack: Story = {
  name: "credit card back",
  render: () => (
    <StoryFrame width={720}>
      <Example_CreditCardBack />
    </StoryFrame>
  ),
};

export const KiboCreditCard: Story = {
  name: "credit card",
  render: () => (
    <StoryFrame width={720}>
      <Example_CreditCard />
    </StoryFrame>
  ),
};

export const KiboDropzoneAccept: Story = {
  name: "dropzone accept",
  render: () => (
    <StoryFrame width={720}>
      <Example_DropzoneAccept />
    </StoryFrame>
  ),
};

export const KiboDropzoneCustomEmptyState: Story = {
  name: "dropzone custom empty state",
  render: () => (
    <StoryFrame width={720}>
      <Example_DropzoneCustomEmptyState />
    </StoryFrame>
  ),
};

export const KiboDropzoneImagePreview: Story = {
  name: "dropzone image preview",
  render: () => (
    <StoryFrame width={720}>
      <Example_DropzoneImagePreview />
    </StoryFrame>
  ),
};

export const KiboDropzoneMinMax: Story = {
  name: "dropzone min max",
  render: () => (
    <StoryFrame width={720}>
      <Example_DropzoneMinMax />
    </StoryFrame>
  ),
};

export const KiboDropzoneMultiple: Story = {
  name: "dropzone multiple",
  render: () => (
    <StoryFrame width={720}>
      <Example_DropzoneMultiple />
    </StoryFrame>
  ),
};

export const KiboDropzone: Story = {
  name: "dropzone",
  render: () => (
    <StoryFrame width={720}>
      <Example_Dropzone />
    </StoryFrame>
  ),
};

export const KiboEditor: Story = {
  name: "editor",
  render: () => (
    <StoryFrame width={720}>
      <Example_Editor />
    </StoryFrame>
  ),
};

export const KiboForm: Story = {
  name: "form",
  render: () => (
    <StoryFrame width={720}>
      <Example_Form />
    </StoryFrame>
  ),
};

export const KiboImageCropCircular: Story = {
  name: "image crop circular",
  render: () => (
    <StoryFrame width={720}>
      <Example_ImageCropCircular />
    </StoryFrame>
  ),
};

export const KiboImageCropCustom: Story = {
  name: "image crop custom",
  render: () => (
    <StoryFrame width={720}>
      <Example_ImageCropCustom />
    </StoryFrame>
  ),
};

export const KiboImageCrop: Story = {
  name: "image crop",
  render: () => (
    <StoryFrame width={720}>
      <Example_ImageCrop />
    </StoryFrame>
  ),
};

export const KiboMiniCalendarControlled: Story = {
  name: "mini calendar controlled",
  render: () => (
    <StoryFrame width={720}>
      <Example_MiniCalendarControlled />
    </StoryFrame>
  ),
};

export const KiboMiniCalendarCustom: Story = {
  name: "mini calendar custom",
  render: () => (
    <StoryFrame width={720}>
      <Example_MiniCalendarCustom />
    </StoryFrame>
  ),
};

export const KiboMiniCalendarDays: Story = {
  name: "mini calendar days",
  render: () => (
    <StoryFrame width={720}>
      <Example_MiniCalendarDays />
    </StoryFrame>
  ),
};

export const KiboMiniCalendar: Story = {
  name: "mini calendar",
  render: () => (
    <StoryFrame width={720}>
      <Example_MiniCalendar />
    </StoryFrame>
  ),
};

export const KiboRatingColors: Story = {
  name: "rating colors",
  render: () => (
    <StoryFrame width={720}>
      <Example_RatingColors />
    </StoryFrame>
  ),
};

export const KiboRatingControlled: Story = {
  name: "rating controlled",
  render: () => (
    <StoryFrame width={720}>
      <Example_RatingControlled />
    </StoryFrame>
  ),
};

export const KiboRatingIcon: Story = {
  name: "rating icon",
  render: () => (
    <StoryFrame width={720}>
      <Example_RatingIcon />
    </StoryFrame>
  ),
};

export const KiboRatingSize: Story = {
  name: "rating size",
  render: () => (
    <StoryFrame width={720}>
      <Example_RatingSize />
    </StoryFrame>
  ),
};

export const KiboRating: Story = {
  name: "rating",
  render: () => (
    <StoryFrame width={720}>
      <Example_Rating />
    </StoryFrame>
  ),
};

export const KiboTagsCreate: Story = {
  name: "tags create",
  render: () => (
    <StoryFrame width={720}>
      <Example_TagsCreate />
    </StoryFrame>
  ),
};

export const KiboTagsFilter: Story = {
  name: "tags filter",
  render: () => (
    <StoryFrame width={720}>
      <Example_TagsFilter />
    </StoryFrame>
  ),
};

export const KiboTags: Story = {
  name: "tags",
  render: () => (
    <StoryFrame width={720}>
      <Example_Tags />
    </StoryFrame>
  ),
};
