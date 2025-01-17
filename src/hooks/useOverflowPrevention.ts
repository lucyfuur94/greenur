import { useEffect } from 'react';

export const useOverflowPrevention = () => {
  useEffect(() => {
    const preventOverflow = () => {
      const elements = document.querySelectorAll('.prevent-overflow');
      elements.forEach((el) => {
        if (el instanceof HTMLElement) {
          el.style.maxWidth = '100%';
          el.style.overflow = 'hidden';
          el.style.textOverflow = 'ellipsis';
          el.style.whiteSpace = 'nowrap';
        }
      });

      const multilineElements = document.querySelectorAll('.multiline-ellipsis');
      multilineElements.forEach((el) => {
        if (el instanceof HTMLElement) {
          el.style.display = '-webkit-box';
          el.style.webkitLineClamp = '2';
          el.style.webkitBoxOrient = 'vertical';
          el.style.overflow = 'hidden';
        }
      });
    };

    preventOverflow();
    window.addEventListener('resize', preventOverflow);

    return () => {
      window.removeEventListener('resize', preventOverflow);
    };
  }, []);
};
