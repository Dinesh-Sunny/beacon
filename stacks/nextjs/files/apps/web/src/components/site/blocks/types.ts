// Props every block renderer takes. `className` adjusts the block's outer section, for example
// a tighter top when it follows a page title.
export type BlockProps<TBlock> = { block: TBlock; className?: string };
