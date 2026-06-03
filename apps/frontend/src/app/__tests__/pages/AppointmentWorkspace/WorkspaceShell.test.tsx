import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import ReadyToggle from '@/app/features/appointments/pages/AppointmentWorkspace/components/ReadyToggle';
import AlertPill from '@/app/features/appointments/pages/AppointmentWorkspace/components/AlertPill';
import WorkspaceStepper from '@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceStepper';
import WorkspaceHeader from '@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceHeader';
import CompanionContextCard from '@/app/features/appointments/pages/AppointmentWorkspace/CompanionContextCard';
import WorkspaceMetaBar from '@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceMetaBar';
import { buildMockEncounter } from '@/app/features/appointments/services/workspaceMockData';
import type { StepStatus, WorkspaceStep } from '@/app/features/appointments/types/workspace';

expect.extend(toHaveNoViolations);

const stepStatus: Record<WorkspaceStep, StepStatus> = {
  SOAP: 'COMPLETED',
  DIAGNOSTICS: 'IN_PROGRESS',
  TREATMENT: 'EMPTY',
  INVOICE: 'EMPTY',
  SUMMARY: 'EMPTY',
};

describe('ReadyToggle', () => {
  it('renders unselected and toggles', () => {
    const onToggle = jest.fn();
    render(<ReadyToggle label="Ready for Billing" state={{ value: false }} onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: /ready for billing/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalled();
  });

  it('renders the green stamp with name and timestamp when selected', () => {
    render(
      <ReadyToggle
        label="Ready for Discharge"
        state={{ value: true, byName: 'Dr Tim', at: new Date().toISOString() }}
        onToggle={jest.fn()}
      />
    );
    expect(screen.getByText('By Dr Tim')).toBeInTheDocument();
    expect(screen.getByText(/Today,/)).toBeInTheDocument();
  });

  it('does not toggle when disabled', () => {
    const onToggle = jest.fn();
    render(
      <ReadyToggle
        label="Ready for Billing"
        state={{ value: false }}
        disabled
        onToggle={onToggle}
      />
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('AlertPill', () => {
  it('renders the label', () => {
    render(<AlertPill label="Needs muzzle" severity="CAUTION" />);
    expect(screen.getByText('Needs muzzle')).toBeInTheDocument();
  });
});

describe('WorkspaceStepper', () => {
  it('renders all five steps and changes step on click', () => {
    const onStepChange = jest.fn();
    render(
      <WorkspaceStepper
        activeStep="DIAGNOSTICS"
        stepStatus={stepStatus}
        onStepChange={onStepChange}
      />
    );
    expect(screen.getByText('SOAP Notes')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Treatment'));
    expect(onStepChange).toHaveBeenCalledWith('TREATMENT');
  });
});

describe('WorkspaceHeader', () => {
  it('renders title, alerts and fires actions', () => {
    const onBack = jest.fn();
    const onQuickActions = jest.fn();
    render(
      <WorkspaceHeader
        companionName="Gigi Hadid"
        alerts={[{ id: '1', label: 'Needs muzzle', severity: 'CAUTION' }]}
        onBack={onBack}
        onQuickActions={onQuickActions}
      />
    );
    // Title uses the companion's first name only.
    expect(screen.getByText(/Gigi’s Appointment/)).toBeInTheDocument();
    expect(screen.getByText('Needs muzzle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /go back/i }));
    fireEvent.click(screen.getByRole('button', { name: /quick actions/i }));
    expect(onBack).toHaveBeenCalled();
    expect(onQuickActions).toHaveBeenCalled();
  });
});

describe('CompanionContextCard', () => {
  const details = [
    { label: 'Name', value: 'Gigi Hadid' },
    { label: 'Patient ID', value: 'PT-48291' },
  ];

  it('renders details and view-details action', () => {
    const onViewDetails = jest.fn();
    render(<CompanionContextCard name="Gigi" details={details} onViewDetails={onViewDetails} />);
    expect(screen.getByText('PT-48291')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));
    expect(onViewDetails).toHaveBeenCalled();
  });

  it('has no axe violations', async () => {
    const { container } = render(<CompanionContextCard name="Gigi" details={details} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('ReadyToggle stamp formatting', () => {
  it('formats a non-today timestamp as month/day', () => {
    render(
      <ReadyToggle
        label="Ready for Billing"
        state={{ value: true, byName: 'A', at: '2020-06-15T12:00:00Z' }}
        onToggle={jest.fn()}
      />
    );
    expect(screen.getByText('By A')).toBeInTheDocument();
    // A past date is rendered as "<Mon> <day>, <time>" — not the "Today," form.
    expect(screen.getByText(/Jun 15,/)).toBeInTheDocument();
    expect(screen.queryByText(/Today,/)).not.toBeInTheDocument();
  });

  it('ignores an invalid timestamp', () => {
    render(
      <ReadyToggle
        label="Ready for Billing"
        state={{ value: true, byName: 'A', at: 'nope' }}
        onToggle={jest.fn()}
      />
    );
    expect(screen.getByText('By A')).toBeInTheDocument();
  });
});

describe('WorkspaceMetaBar', () => {
  const baseProps = (mode: 'OUTPATIENT' | 'INPATIENT') => ({
    encounter: buildMockEncounter('a1', mode),
    activeStep: 'SOAP' as WorkspaceStep,
    leadOptions: [{ label: 'Dr Tim', value: 'usr-tim' }],
    nurseOptions: [{ label: 'Sarah', value: 'usr-sarah' }],
    roomOptions: [{ label: 'Room 1', value: 'room-1' }],
    unitOptions: [{ label: '24', value: 'unit-24' }],
    onSelectLead: jest.fn(),
    onSelectNurse: jest.fn(),
    onSelectRoom: jest.fn(),
    onSelectUnit: jest.fn(),
    onSelectEncounterMode: jest.fn(),
    onSaveAndNext: jest.fn(),
    onToggleReadyForBilling: jest.fn(),
    onToggleReadyForDischarge: jest.fn(),
    togglesLocked: false,
  });

  it('renders consultation type for outpatient and fires Save & Next', () => {
    const props = baseProps('OUTPATIENT');
    render(<WorkspaceMetaBar {...props} />);
    expect(screen.getByText('Ready for Billing')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Diagnostics'));
    expect(props.onSaveAndNext).toHaveBeenCalled();
  });

  it('fires the temporary appointment type switch from the consultation dropdown', () => {
    const props = baseProps('OUTPATIENT');
    render(<WorkspaceMetaBar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /consultation type: outpatient/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Inpatient' }));
    expect(props.onSelectEncounterMode).toHaveBeenCalledWith('INPATIENT');
  });

  it('renders room and unit dropdowns for inpatient', () => {
    const props = baseProps('INPATIENT');
    render(<WorkspaceMetaBar {...props} />);
    expect(screen.getByText('Room')).toBeInTheDocument();
    expect(screen.getByText('Unit')).toBeInTheDocument();
  });

  it('shows a custom primary CTA when provided', () => {
    const props = baseProps('OUTPATIENT');
    const onClick = jest.fn();
    render(<WorkspaceMetaBar {...props} primaryCta={{ label: 'Skip to Summary', onClick }} />);
    fireEvent.click(screen.getByText('Skip to Summary'));
    expect(onClick).toHaveBeenCalled();
  });

  it('toggles ready flags', () => {
    const props = baseProps('OUTPATIENT');
    render(<WorkspaceMetaBar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /ready for billing/i }));
    fireEvent.click(screen.getByRole('button', { name: /ready for discharge/i }));
    expect(props.onToggleReadyForBilling).toHaveBeenCalled();
    expect(props.onToggleReadyForDischarge).toHaveBeenCalled();
  });

  it('keeps the ready toggles interactive when only the content is view-only', () => {
    // A checked Ready-for-Discharge marks the encounter view-only, but the
    // toggle itself must stay clickable so a mistaken check can be undone.
    const props = baseProps('OUTPATIENT');
    const encounter = {
      ...props.encounter,
      viewOnly: true,
      readyForDischarge: { value: true, byName: 'A', at: '2026-06-02T12:00:00Z' },
    };
    render(<WorkspaceMetaBar {...props} encounter={encounter} togglesLocked={false} />);
    const discharge = screen.getByRole('button', { name: /ready for discharge/i });
    expect(discharge).not.toBeDisabled();
    fireEvent.click(discharge);
    expect(props.onToggleReadyForDischarge).toHaveBeenCalled();
  });

  it('locks the ready toggles when togglesLocked is set', () => {
    const props = baseProps('OUTPATIENT');
    render(<WorkspaceMetaBar {...props} togglesLocked />);
    expect(screen.getByRole('button', { name: /ready for discharge/i })).toBeDisabled();
  });
});
