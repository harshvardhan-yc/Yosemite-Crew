import { HydratedDocument, Schema, model } from 'mongoose'

const AddressSchema = new Schema(
    {
        addressLine: { type: String },
        country: { type: String },
        city: { type: String },
        state: { type: String },
        postalCode: { type: String },
        latitude: { type: Number },
        longitude: { type: Number },
    },
    { _id: false }
)

export interface ParentMongo {
    userId: string
    fhirId?: string
    firstName: string
    lastName?: string
    age: number
    address: {
        addressLine?: string
        country?: string
        city?: string
        state?: string
        postalCode?: string
        latitude?: number
        longitude?: number
    }
    phoneNumber?: string
    profileImageUrl?: string
    birthDate?: Date
}

const ParentSchema = new Schema<ParentMongo>(
    {
        userId: { type: String, required: true, index: true, unique: true },
        fhirId: { type: String, index: true, unique: true, sparse: true },
        firstName: { type: String, required: true },
        lastName: { type: String },
        age: { type: Number, required: true },
        address: { type: AddressSchema, required: true },
        phoneNumber: { type: String },
        profileImageUrl: { type: String },
        birthDate: { type: Date },
    },
    {
        timestamps: true,
    }
)

export type ParentDocument = HydratedDocument<ParentMongo>

const ParentModel = model<ParentMongo>('Parent', ParentSchema)

export default ParentModel
