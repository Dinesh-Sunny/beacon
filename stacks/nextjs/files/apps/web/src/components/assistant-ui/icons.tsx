// assistant-ui's components import Lucide icons by name; the app uses Hugeicons (components.json).
// Same names, Hugeicons inside, so the vendored files stay close to upstream and one icon set ships.
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp02Icon,
  AudioWave01Icon,
  Call02Icon,
  Cancel01Icon,
  CancelCircleIcon,
  CodeIcon,
  Copy01Icon,
  Download01Icon,
  File01Icon,
  File02Icon,
  BrainIcon as HugeBrainIcon,
  MoreHorizontalIcon as HugeMoreHorizontalIcon,
  PauseIcon as HugePauseIcon,
  PlayIcon as HugePlayIcon,
  ThumbsDownIcon as HugeThumbsDownIcon,
  ThumbsUpIcon as HugeThumbsUpIcon,
  Image01Icon,
  ImageNotFound01Icon,
  Loading03Icon,
  Mic01Icon,
  MinusSignCircleIcon,
  MusicNote01Icon,
  PencilEdit02Icon,
  PlusSignIcon,
  RefreshIcon,
  ShieldBlockchainIcon,
  StopIcon,
  Tick02Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ComponentProps } from "react";

type IconProps = Omit<ComponentProps<typeof HugeiconsIcon>, "icon">;
type IconSvg = ComponentProps<typeof HugeiconsIcon>["icon"];

function hugeicon(svg: IconSvg) {
  return function Icon(props: IconProps) {
    return <HugeiconsIcon icon={svg} strokeWidth={2} {...props} />;
  };
}

export const AlertCircleIcon = hugeicon(Alert02Icon);
export const ArrowDownIcon = hugeicon(ArrowDown01Icon);
export const ArrowUpIcon = hugeicon(ArrowUp02Icon);
export const AudioLinesIcon = hugeicon(AudioWave01Icon);
export const BracesIcon = hugeicon(CodeIcon);
export const BrainIcon = hugeicon(HugeBrainIcon);
export const CheckIcon = hugeicon(Tick02Icon);
export const ChevronDownIcon = hugeicon(ArrowDown01Icon);
export const ChevronLeftIcon = hugeicon(ArrowLeft01Icon);
export const ChevronRightIcon = hugeicon(ArrowRight01Icon);
export const CircleMinusIcon = hugeicon(MinusSignCircleIcon);
export const CopyIcon = hugeicon(Copy01Icon);
export const DownloadIcon = hugeicon(Download01Icon);
export const FileIcon = hugeicon(File01Icon);
export const FileTextIcon = hugeicon(File02Icon);
export const FileText = FileTextIcon;
export const ImageIcon = hugeicon(Image01Icon);
export const ImageOffIcon = hugeicon(ImageNotFound01Icon);
export const LoaderIcon = hugeicon(Loading03Icon);
export const Loader2Icon = LoaderIcon;
export const MicIcon = hugeicon(Mic01Icon);
export const MoreHorizontalIcon = hugeicon(HugeMoreHorizontalIcon);
export const MusicIcon = hugeicon(MusicNote01Icon);
export const PauseIcon = hugeicon(HugePauseIcon);
export const PencilIcon = hugeicon(PencilEdit02Icon);
export const PhoneIcon = hugeicon(Call02Icon);
export const PlayIcon = hugeicon(HugePlayIcon);
export const PlusIcon = hugeicon(PlusSignIcon);
export const RefreshCwIcon = hugeicon(RefreshIcon);
export const ShieldAlertIcon = hugeicon(ShieldBlockchainIcon);
export const SquareIcon = hugeicon(StopIcon);
export const ThumbsDownIcon = hugeicon(HugeThumbsDownIcon);
export const ThumbsUpIcon = hugeicon(HugeThumbsUpIcon);
export const VideoIcon = hugeicon(Video01Icon);
export const XCircleIcon = hugeicon(CancelCircleIcon);
export const XIcon = hugeicon(Cancel01Icon);
