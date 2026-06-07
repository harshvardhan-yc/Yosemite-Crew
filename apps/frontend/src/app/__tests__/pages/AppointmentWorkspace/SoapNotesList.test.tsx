import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SoapNotesList, {
  type SoapNoteListItem,
} from '@/app/features/appointments/pages/AppointmentWorkspace/components/SoapNotesList';

const items: SoapNoteListItem[] = [
  {
    id: 'soap-1',
    signedByName: 'Dr. Tim Apple',
    date: 'Apr 21, 2026',
    time: '09:45 AM',
    fields: [
      { label: 'Chief complaint', text: 'vomiting and feeling sick' },
      { label: 'Subjective (History)', html: '<p>owner reports limping</p>' },
      { label: 'Plan', html: '<ul><li>Amoxicillin</li></ul>' },
    ],
  },
];

describe('SoapNotesList', () => {
  it('renders nothing when there are no notes', () => {
    const { container } = render(<SoapNotesList items={[]} onPrint={jest.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a floating-label container with one row per note', () => {
    render(<SoapNotesList items={items} onPrint={jest.fn()} />);
    expect(screen.getByText('All SOAP notes')).toBeInTheDocument();
    expect(screen.getByText('SOAP Note')).toBeInTheDocument();
    expect(screen.getByText(/By Dr. Tim Apple/)).toBeInTheDocument();
    expect(screen.getByText('Apr 21, 2026')).toBeInTheDocument();
    expect(screen.getByText('09:45 AM')).toBeInTheDocument();
    // Online-signed notes show the "Signed" status chip.
    expect(screen.getByText('Signed')).toBeInTheDocument();
  });

  it('shows an offline status chip for offline-signed notes', () => {
    render(<SoapNotesList items={[{ ...items[0], signedOffline: true }]} onPrint={jest.fn()} />);
    expect(screen.getByText('Signed offline')).toBeInTheDocument();
  });

  it('prints a note from the row print action', () => {
    const onPrint = jest.fn();
    render(<SoapNotesList items={items} onPrint={onPrint} />);
    fireEvent.click(screen.getByRole('button', { name: /print soap note by dr\. tim apple/i }));
    expect(onPrint).toHaveBeenCalledWith(items[0]);
  });

  it('expands and collapses the nested read-out', () => {
    render(<SoapNotesList items={items} onPrint={jest.fn()} />);
    expect(screen.queryByText('vomiting and feeling sick')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /view soap note by dr\. tim apple/i }));
    expect(screen.getByText('vomiting and feeling sick')).toBeInTheDocument();
    expect(screen.getByText('owner reports limping')).toBeInTheDocument();
    expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hide soap note by dr\. tim apple/i }));
    expect(screen.queryByText('vomiting and feeling sick')).not.toBeInTheDocument();
  });

  it('renders a dash for empty rich-text and empty plain-text fields', () => {
    render(
      <SoapNotesList
        onPrint={jest.fn()}
        items={[
          {
            id: 's',
            signedByName: 'Dr X',
            fields: [
              { label: 'Plan', html: '' },
              { label: 'Chief complaint', text: '' },
            ],
          },
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /view soap note by dr x/i }));
    // Both the empty html field and the empty plain-text field collapse to a dash.
    expect(screen.getAllByText('-')).toHaveLength(2);
  });
});
