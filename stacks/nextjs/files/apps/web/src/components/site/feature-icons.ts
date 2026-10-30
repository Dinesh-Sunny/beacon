import {
  ChartLineData01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  CustomerSupportIcon,
  DeliveryTruck01Icon,
  FavouriteIcon,
  FlashIcon,
  GlobeIcon,
  Leaf01Icon,
  Rocket01Icon,
  Settings02Icon,
  Shield01Icon,
  SparklesIcon,
  SquareLock02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { FeatureIcon } from "@/payload/constants";

// The glyph for each icon an editor can pick (payload/constants FEATURE_ICONS).
export const FEATURE_ICON_GLYPHS = {
  sparkles: SparklesIcon,
  shield: Shield01Icon,
  rocket: Rocket01Icon,
  flash: FlashIcon,
  people: UserGroupIcon,
  clock: Clock01Icon,
  globe: GlobeIcon,
  lock: SquareLock02Icon,
  check: CheckmarkCircle02Icon,
  chart: ChartLineData01Icon,
  support: CustomerSupportIcon,
  leaf: Leaf01Icon,
  settings: Settings02Icon,
  delivery: DeliveryTruck01Icon,
  heart: FavouriteIcon,
} as const satisfies Record<FeatureIcon, IconSvgElement>;
