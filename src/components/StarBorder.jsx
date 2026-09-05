import './StarBorder.css';

/**
 * Adapted from the react-bits registry pull (`npx shadcn add
 * @react-bits/StarBorder-JS-CSS`): the original hardcodes the inner
 * content's background/border/padding/radius/color as plain (unlayered)
 * CSS in StarBorder.css, which — per this codebase's documented cascade
 * trap (see CLAUDE.md) — silently beats any Tailwind utility class of equal
 * specificity regardless of source order, since Tailwind's utilities live
 * inside `@layer utilities`. StarBorder.css has been stripped to only the
 * structural rules the comet animation needs; every visual choice (shape,
 * fill, border, padding) is now the caller's via `className` (outer,
 * clips + shapes the comet) and `innerClassName` (the actual card face).
 */
const StarBorder = ({
  as: Component = 'button',
  className = '',
  innerClassName = '',
  color = 'white',
  speed = '6s',
  thickness = 1,
  children,
  ...rest
}) => {
  return (
    <Component
      className={`star-border-container ${className}`}
      style={{
        padding: `${thickness}px 0`,
        ...rest.style
      }}
      {...rest}
    >
      <div
        className="border-gradient-bottom"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 22%)`,
          animationDuration: speed
        }}
      ></div>
      <div
        className="border-gradient-top"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 22%)`,
          animationDuration: speed
        }}
      ></div>
      <div className={`inner-content ${innerClassName}`}>{children}</div>
    </Component>
  );
};

export default StarBorder;
