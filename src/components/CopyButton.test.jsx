import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CopyButton, CellCopyButton } from './CopyButton';

describe('CopyButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with Copy text initially', () => {
      render(<CopyButton text="test text" />);
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    it('has correct title attribute', () => {
      render(<CopyButton text="test text" />);
      expect(screen.getByTitle('Copy to clipboard')).toBeInTheDocument();
    });

    it('renders as a button element', () => {
      render(<CopyButton text="test text" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('copy functionality', () => {
    it('copies text to clipboard when clicked', async () => {
      render(<CopyButton text="test content" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test content');
    });

    it('shows Copied! text after click', async () => {
      render(<CopyButton text="test" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });

    it('stops event propagation on click', async () => {
      const parentClickHandler = vi.fn();
      render(
        <div onClick={parentClickHandler}>
          <CopyButton text="test" />
        </div>
      );

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });

  describe('styling states', () => {
    it('has default styling when not copied', () => {
      render(<CopyButton text="test" />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('border-gray-200');
    });

    it('has success styling when copied', async () => {
      render(<CopyButton text="test" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-green-500');
    });
  });
});

describe('CellCopyButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders as a button element', () => {
      render(<CellCopyButton text="test" />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('has correct title attribute', () => {
      render(<CellCopyButton text="test" />);
      expect(screen.getByTitle('Copy')).toBeInTheDocument();
    });

    it('starts with copy icon styling', () => {
      render(<CellCopyButton text="test" />);
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-gray-200');
    });
  });

  describe('copy functionality', () => {
    it('copies text to clipboard when clicked', async () => {
      render(<CellCopyButton text="cell content" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('cell content');
    });

    it('shows success state after click', async () => {
      render(<CellCopyButton text="test" />);

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-green-500');
    });

    it('stops event propagation on click', async () => {
      const parentClickHandler = vi.fn();
      render(
        <div onClick={parentClickHandler}>
          <CellCopyButton text="test" />
        </div>
      );

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });
});
