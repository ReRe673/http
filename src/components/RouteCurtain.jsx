const forwardPath = [
  'M 0 100 V 100 Q 50 100 100 100 V 100 z',
  'M 0 100 V 50 Q 50 0 100 50 V 100 z',
  'M 0 100 V 0 Q 50 0 100 0 V 100 z',
  'M 0 0 V 50 Q 50 100 100 50 V 0 z',
  'M 0 0 V 0 Q 50 0 100 0 V 0 z',
];

const backwardPath = [
  'M 0 0 V 0 Q 50 0 100 0 V 0 z',
  'M 0 0 V 50 Q 50 100 100 50 V 0 z',
  'M 0 0 V 100 Q 50 100 100 100 V 0 z',
  'M 0 100 V 50 Q 50 0 100 50 V 100 z',
  'M 0 100 V 100 Q 50 100 100 100 V 100 z',
];

export function RouteCurtain({ active, direction, transitionId }) {
  if (!active) return null;
  const paths = direction === 'backward' ? backwardPath : forwardPath;
  return (
    <div className="route-curtain" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={paths[0]}>
          <animate
            key={transitionId}
            attributeName="d"
            dur="1.55s"
            values={paths.join(';')}
            keyTimes="0;0.38;0.5;0.62;1"
            calcMode="spline"
            keySplines="0.76 0 0.24 1;0.55 0 1 0.45;0.45 0 0.55 1;0.16 1 0.3 1"
            fill="freeze"
          />
        </path>
      </svg>
      <span>YJX · INTERACTION DESIGN</span>
    </div>
  );
}
