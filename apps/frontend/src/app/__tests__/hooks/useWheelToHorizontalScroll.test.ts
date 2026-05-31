import { renderHook } from '@testing-library/react';
import { useWheelToHorizontalScroll } from '@/app/hooks/useWheelToHorizontalScroll';

const setElementMetrics = (
  element: HTMLElement,
  metrics: Partial<Pick<HTMLElement, 'clientHeight' | 'scrollHeight' | 'scrollTop'>> = {}
) => {
  Object.defineProperty(element, 'clientHeight', {
    value: metrics.clientHeight ?? 100,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(element, 'scrollHeight', {
    value: metrics.scrollHeight ?? 100,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(element, 'scrollTop', {
    value: metrics.scrollTop ?? 0,
    writable: true,
    configurable: true,
  });
};

describe('useWheelToHorizontalScroll', () => {
  it('does not call preventDefault from the React passive wheel path', () => {
    const { result } = renderHook(() => useWheelToHorizontalScroll());
    const boundary = document.createElement('div');
    const target = document.createElement('div');
    boundary.appendChild(target);
    setElementMetrics(boundary);
    setElementMetrics(target);
    boundary.scrollLeft = 0;

    const preventDefault = jest.fn();
    const addEventListener = jest.spyOn(boundary, 'addEventListener');

    result.current({
      deltaY: 24,
      target,
      currentTarget: boundary,
      nativeEvent: {
        deltaY: 24,
        target,
        cancelable: true,
        preventDefault,
      },
    } as unknown as React.WheelEvent<HTMLElement>);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(boundary.scrollLeft).toBe(24);
    expect(addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function), {
      passive: false,
    });
  });

  it('uses a non-passive native wheel listener for cancelable wheel events', () => {
    const { result } = renderHook(() => useWheelToHorizontalScroll());
    const boundary = document.createElement('div');
    const target = document.createElement('div');
    boundary.appendChild(target);
    setElementMetrics(boundary);
    setElementMetrics(target);
    boundary.scrollLeft = 0;

    let nativeListener: EventListener | null = null;
    jest.spyOn(boundary, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'wheel' && typeof listener === 'function') {
        nativeListener = listener;
      }
    });

    result.current({
      deltaY: 0,
      target,
      currentTarget: boundary,
      nativeEvent: new WheelEvent('wheel', { deltaY: 0, cancelable: true }),
    } as unknown as React.WheelEvent<HTMLElement>);

    const event = new WheelEvent('wheel', { deltaY: 32, cancelable: true });
    Object.defineProperty(event, 'target', {
      value: target,
      configurable: true,
    });
    const preventDefault = jest.spyOn(event, 'preventDefault');

    const listener = nativeListener as unknown as EventListener;
    listener(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(boundary.scrollLeft).toBe(32);
  });
});
