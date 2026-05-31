import React, { useState } from 'react';
import CenterModal from '@/app/ui/overlays/Modal/CenterModal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import Primary from '@/app/ui/primitives/Buttons/Primary';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import { useNotify } from '@/app/hooks/useNotify';

type AddSpecialityModalProps = {
  showModal: boolean;
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>;
  organisationId: string;
};

const AddSpecialityModal = ({
  showModal,
  setShowModal,
  organisationId,
}: AddSpecialityModalProps) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const addSpeciality = useRevampCatalogStore((s) => s.addSpeciality);
  const { notify } = useNotify();

  const handleClose = () => {
    setName('');
    setError('');
    setShowModal(false);
  };

  const submitSpeciality = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Speciality name is required.');
      return;
    }
    addSpeciality(trimmed, organisationId);
    notify('success', { title: 'Speciality added', text: `"${trimmed}" has been created.` });
    handleClose();
  };

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitSpeciality();
  };

  return (
    <CenterModal showModal={showModal} setShowModal={setShowModal} onClose={handleClose}>
      <ModalHeader title="Add Speciality" onClose={handleClose} />
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormInput
          intype="text"
          inlabel="Speciality name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError('');
          }}
          error={error}
        />
        <div className="grid grid-cols-2 gap-3">
          <Secondary href="#" text="Cancel" onClick={handleClose} />
          <Primary href="#" text="Add Speciality" onClick={submitSpeciality} />
        </div>
      </form>
    </CenterModal>
  );
};

export default AddSpecialityModal;
