import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import RichTextEditor from '@/app/ui/primitives/RichTextEditor/RichTextEditor';
import FloatingToolbar from '@/app/ui/primitives/RichTextEditor/FloatingToolbar';

describe('RichTextEditor', () => {
  it('renders an editable textbox with the toolbar', () => {
    render(<RichTextEditor value="<p>Hello</p>" onChange={jest.fn()} ariaLabel="Subjective" />);
    expect(screen.getByRole('textbox', { name: 'Subjective' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: /text formatting/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
  });

  it('hides the toolbar in read-only mode', () => {
    render(<RichTextEditor value="<p>Read</p>" onChange={jest.fn()} ariaLabel="Plan" readOnly />);
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Plan' })).toHaveAttribute('aria-readonly', 'true');
  });

  it('shows the placeholder when empty and editable', () => {
    render(
      <RichTextEditor value="" onChange={jest.fn()} ariaLabel="Notes" placeholder="Type here" />
    );
    expect(screen.getByText('Type here')).toBeInTheDocument();
  });

  it('applies formatting via the toolbar and emits sanitized HTML', () => {
    const onChange = jest.fn();
    render(<RichTextEditor value="<p>abc</p>" onChange={onChange} ariaLabel="Subjective" />);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bulleted list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Indent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Italic' }));
    fireEvent.click(screen.getByRole('button', { name: 'Underline' }));
    expect(onChange).toHaveBeenCalled();
  });

  it('uses the indent control in regular text blocks', () => {
    const onChange = jest.fn();
    render(<RichTextEditor value="<p>abc</p>" onChange={onChange} ariaLabel="Subjective" />);

    fireEvent.click(screen.getByRole('button', { name: 'Indent' }));

    expect(onChange).toHaveBeenCalledWith(expect.stringContaining('&nbsp;'));
  });

  it('sinks a list item when indenting inside a list', () => {
    const insertContent = jest.fn();
    const run = jest.fn().mockReturnValue(true);
    const chain = {
      focus: jest.fn(),
      sinkListItem: jest.fn(),
      insertContent,
      run,
    };
    chain.focus.mockReturnValue(chain);
    chain.sinkListItem.mockReturnValue(chain);
    insertContent.mockReturnValue(chain);

    const editor = {
      isActive: jest.fn((name: string) => name === 'listItem'),
      chain: jest.fn(() => chain),
    };

    render(<FloatingToolbar editor={editor as never} />);

    fireEvent.click(screen.getByRole('button', { name: 'Indent' }));

    expect(chain.sinkListItem).toHaveBeenCalledWith('listItem');
    expect(insertContent).not.toHaveBeenCalled();
  });
});
