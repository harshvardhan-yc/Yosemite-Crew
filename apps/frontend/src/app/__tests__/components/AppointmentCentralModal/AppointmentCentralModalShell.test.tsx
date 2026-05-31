import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('@/app/ui/overlays/Modal/ModalBase', () => ({
  __esModule: true,
  default: ({
    showModal,
    children,
    ignoreOutsideClick: _ign,
    overlayClassName: _oc,
    overlayStyle: _os,
    containerClassName: _cc,
    setShowModal: _ssm,
    canClose: _cc2,
    onClose: _oc2,
    ...rest
  }: any) =>
    showModal ? (
      <div data-testid="modal-base" {...rest}>
        {children}
      </div>
    ) : null,
}));

jest.mock('@/app/ui/overlays/Loader', () => ({
  YosemiteLoader: ({ label }: any) => <div data-testid="yosemite-loader">{label}</div>,
}));

jest.mock('react-icons/io5', () => ({
  IoClose: () => <span data-testid="io-close" />,
}));

import AppointmentCentralModalShell from '@/app/features/appointments/components/AppointmentCentralModal/AppointmentCentralModalShell';

const defaultProps = {
  showModal: true,
  setShowModal: jest.fn(),
  title: 'Book Appointment',
  children: <div data-testid="modal-body">Body content</div>,
};

describe('AppointmentCentralModalShell', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal with title and children when showModal is true', () => {
    render(<AppointmentCentralModalShell {...defaultProps} />);
    expect(screen.getByTestId('modal-base')).toBeInTheDocument();
    expect(screen.getByText('Book Appointment')).toBeInTheDocument();
    expect(screen.getByTestId('modal-body')).toBeInTheDocument();
  });

  it('does not render when showModal is false', () => {
    render(<AppointmentCentralModalShell {...defaultProps} showModal={false} />);
    expect(screen.queryByTestId('modal-base')).not.toBeInTheDocument();
  });

  it('renders loading overlay with default label when isLoading is true', () => {
    render(<AppointmentCentralModalShell {...defaultProps} isLoading={true} />);
    expect(screen.getByTestId('yosemite-loader')).toBeInTheDocument();
    expect(screen.getByTestId('yosemite-loader')).toHaveTextContent('Booking appointment');
    expect(screen.getByText('Finalizing your appointment…')).toBeInTheDocument();
  });

  it('renders loading overlay with custom label', () => {
    render(
      <AppointmentCentralModalShell
        {...defaultProps}
        isLoading={true}
        loadingLabel="Rescheduling"
      />
    );
    expect(screen.getByTestId('yosemite-loader')).toHaveTextContent('Rescheduling');
  });

  it('does not render loading overlay when isLoading is false', () => {
    render(<AppointmentCentralModalShell {...defaultProps} isLoading={false} />);
    expect(screen.queryByTestId('yosemite-loader')).not.toBeInTheDocument();
    expect(screen.queryByText('Finalizing your appointment…')).not.toBeInTheDocument();
  });

  it('close button calls setShowModal(false) and onClose', () => {
    const setShowModal = jest.fn();
    const onClose = jest.fn();
    render(
      <AppointmentCentralModalShell
        {...defaultProps}
        setShowModal={setShowModal}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(setShowModal).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalled();
  });

  it('close button does nothing when canClose returns false', () => {
    const setShowModal = jest.fn();
    render(
      <AppointmentCentralModalShell
        {...defaultProps}
        setShowModal={setShowModal}
        canClose={() => false}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(setShowModal).not.toHaveBeenCalled();
  });

  it('close button calls setShowModal when canClose returns true', () => {
    const setShowModal = jest.fn();
    render(
      <AppointmentCentralModalShell
        {...defaultProps}
        setShowModal={setShowModal}
        canClose={() => true}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(setShowModal).toHaveBeenCalledWith(false);
  });

  it('renders title with provided text', () => {
    render(<AppointmentCentralModalShell {...defaultProps} title="Edit Appointment" />);
    expect(screen.getByText('Edit Appointment')).toBeInTheDocument();
  });
});
