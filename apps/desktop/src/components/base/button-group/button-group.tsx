import { type FC, type PropsWithChildren, type ReactNode, type RefAttributes, createContext, isValidElement, useContext } from 'react'
import { ToggleButton as AriaToggleButton, ToggleButtonGroup as AriaToggleButtonGroup, type ToggleButtonGroupProps, type ToggleButtonProps } from 'react-aria-components'
import { cx, sortCx } from '@/utils/cx'
import { isReactComponent } from '@/utils/is-react-component'

const styles = sortCx({
  common: {
    root: 'group/button-group inline-flex h-max cursor-pointer items-center bg-primary font-semibold whitespace-nowrap text-secondary shadow-skeuomorphic ring-1 ring-primary outline-brand transition duration-100 ease-linear ring-inset hover:bg-primary_hover hover:text-secondary_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:text-secondary/50 disabled:*:opacity-50 selected:bg-primary_hover selected:text-secondary_hover',
    icon: 'pointer-events-none text-fg-quaternary transition-[inherit] group-hover/button-group:text-fg-quaternary_hover group-selected/button-group:text-fg-quaternary_hover',
  },
  sizes: {
    sm: { root: 'gap-1.5 px-3.5 py-2 text-sm not-last:pr-[calc(calc(var(--spacing)*3.5)+1px)] first:rounded-l-lg last:rounded-r-lg data-icon-leading:pl-3 data-icon-only:px-2.5', icon: 'size-5' },
    md: { root: 'gap-1.5 px-4 py-2.5 text-sm not-last:pr-[calc(calc(var(--spacing)*4)+1px)] first:rounded-l-lg last:rounded-r-lg data-icon-leading:pl-3.5 data-icon-only:px-3', icon: 'size-5' },
    lg: { root: 'gap-2 px-4.5 py-2.5 text-md not-last:pr-[calc(calc(var(--spacing)*4.5)+1px)] first:rounded-l-lg last:rounded-r-lg data-icon-leading:pl-4 data-icon-only:px-3.5', icon: 'size-5' },
  },
})

type ButtonSize = keyof typeof styles.sizes
const ButtonGroupContext = createContext<{ size: ButtonSize }>({ size: 'md' })

interface ButtonGroupItemProps extends ToggleButtonProps, RefAttributes<HTMLButtonElement> {
  iconLeading?: FC<{ className?: string }> | ReactNode
  iconTrailing?: FC<{ className?: string }> | ReactNode
  className?: string
}

export function ButtonGroupItem({ iconLeading: IconLeading, iconTrailing: IconTrailing, children, className, ...props }: PropsWithChildren<ButtonGroupItemProps>) {
  const { size } = useContext(ButtonGroupContext)
  const isIcon = (IconLeading || IconTrailing) && !children
  return (
    <AriaToggleButton {...props} data-icon-only={isIcon || undefined} data-icon-leading={IconLeading || undefined} className={cx(styles.common.root, styles.sizes[size].root, className)}>
      {isReactComponent(IconLeading) && <IconLeading className={cx(styles.common.icon, styles.sizes[size].icon)} />}
      {isValidElement(IconLeading) && IconLeading}
      {children}
      {isReactComponent(IconTrailing) && <IconTrailing className={cx(styles.common.icon, styles.sizes[size].icon)} />}
      {isValidElement(IconTrailing) && IconTrailing}
    </AriaToggleButton>
  )
}

interface ButtonGroupProps extends Omit<ToggleButtonGroupProps, 'orientation'>, RefAttributes<HTMLDivElement> {
  size?: ButtonSize
  className?: string
}

export function ButtonGroup({ children, size = 'md', className, ...props }: ButtonGroupProps) {
  return (
    <ButtonGroupContext.Provider value={{ size }}>
      <AriaToggleButtonGroup selectionMode="single" className={cx('relative z-0 inline-flex w-max -space-x-px rounded-lg shadow-xs', className)} {...props}>
        {children}
      </AriaToggleButtonGroup>
    </ButtonGroupContext.Provider>
  )
}
