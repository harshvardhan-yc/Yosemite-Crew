"use client";
import React from "react";
import { Button, Dropdown } from "react-bootstrap";
import Image from "next/image";
import { FaUser } from "react-icons/fa6";
import { BsThreeDotsVertical } from "react-icons/bs";
import { Icon } from "@iconify/react/dist/iconify.js";

import GenericTable from "@/app/components/GenericTable/GenericTable";

import "./DataTable.css";

type Column<T> = {
  label: string;
  key: keyof T | string;
  width?: string;
  render?: (item: T) => React.ReactNode;
};

type AppointmentStatus = "In-progress" | "Checked-In" | "Pending";

type TodayAppointmentItem = {
  name: string;
  owner: string;
  image: string;
  tokenNumber: string;
  reason: string;
  petType: string;
  pet: string;
  time: string;
  date: string;
  participants: any;
  specialization: string;
  status: AppointmentStatus;
};

const columns: Column<TodayAppointmentItem>[] = [
  {
    label: "",
    key: "avatar",
    width: "60px",
    render: (item: TodayAppointmentItem) => (
      <Image
        src={item.image}
        alt={item.name}
        width={40}
        height={40}
        style={{ borderRadius: "50%" }}
      />
    ),
  },
  {
    label: "Name",
    key: "name",
    render: (item: TodayAppointmentItem) => (
      <div className="user-info">
        <div>
          <p className="name">{item.name}</p>
          <span className="owner">
            <FaUser /> {item.owner}
          </span>
        </div>
      </div>
    ),
  },
  {
    label: "Appointment ID",
    key: "appointmentId",
    render: (item: TodayAppointmentItem) => <p>{item.tokenNumber}</p>,
  },
  {
    label: "Reason for Appointment",
    key: "reason",
    render: (item: TodayAppointmentItem) => <p>{item.reason}</p>,
  },
  {
    label: "Breed/Pet",
    key: "breed",
    render: (item: TodayAppointmentItem) => (
      <p>
        {item.pet}/{item.petType}
      </p>
    ),
  },
  {
    label: "Date",
    key: "date",
    render: (item: TodayAppointmentItem) => (
      <div>
        <p>{item.time}</p>
        <span>{item.date}</span>
      </div>
    ),
  },
  {
    label: "Doctor",
    key: "doctor",
    render: (item: TodayAppointmentItem) => (
      <div>
        <p>{item?.participants?.name}</p>
        <span>{item.specialization}</span>
      </div>
    ),
  },
  {
    label: "Actions",
    key: "actions",
    render: (item: TodayAppointmentItem) => (
      <div className="action-btn-col">
        {item.status === "In-progress" ? (
          <Button className="circle-btn done" title="Done">
            <Icon icon="carbon:checkmark-filled" width="24" height="24" />
          </Button>
        ) : (
          <Button
            className="circle-btn view"
            title="View"
            onClick={() => console.log("View", item)}
          >
            <Icon icon="solar:eye-bold" width="24" height="24" />
          </Button>
        )}
      </div>
    ),
  },
  {
    label: "",
    key: "actionsDropdown",
    render: (item: TodayAppointmentItem) => (
      <div className="action-dropdown">
        <Dropdown align="end">
          <Dropdown.Toggle as="span" className="custom-toggle">
            <BsThreeDotsVertical className="menu-icon" />
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={() => console.log("Edit", item)}>
              Edit
            </Dropdown.Item>
            <Dropdown.Item onClick={() => console.log("Save", item)}>
              Save
            </Dropdown.Item>
            <Dropdown.Item onClick={() => console.log("Delete", item)}>
              Delete
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    ),
  },
];

const AppointmentsTable = ({ data }: any) => {
  return (
    <div className="table-wrapper">
      <GenericTable
        data={data}
        columns={columns}
        bordered={false}
        pagination
        pageSize={6}
      />
      {/* <div className="table-footerBtn ">
            <Button>Sell All</Button>
          </div> */}
    </div>
  );
};

export default AppointmentsTable;
