var __decorate =
	(this && this.__decorate) ||
	function (decorators, target, key, desc) {
		var c = arguments.length,
			r = c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
			d
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
			r = Reflect.decorate(decorators, target, key, desc)
		else
			for (var i = decorators.length - 1; i >= 0; i--)
				if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r
		return c > 3 && r && Object.defineProperty(target, key, r), r
	}
import _ from "lodash"
import { AutoCastable, Prop, RPC_MARSHAL } from "civkit/civ-rpc"
import { Firestore, FieldValue, DocumentReference, Timestamp, DocumentSnapshot } from "@google-cloud/firestore"
import { Storage } from "@google-cloud/storage"
export const firebaseDefaultBucket = new Storage().bucket(`${process.env.GCLOUD_PROJECT}.appspot.com`)
// Firestore doesn't support JavaScript objects with custom prototypes (i.e. objects that were created via the \"new\" operator)
function patchFireStoreArrogance(func) {
	return function () {
		const origObjectGetPrototype = Object.getPrototypeOf
		Object.getPrototypeOf = function (x) {
			const r = origObjectGetPrototype.call(this, x)
			if (!r) {
				return r
			}
			return Object.prototype
		}
		try {
			return func.call(this, ...arguments)
		} finally {
			Object.getPrototypeOf = origObjectGetPrototype
		}
	}
}
Reflect.set(
	DocumentReference.prototype,
	"set",
	patchFireStoreArrogance(Reflect.get(DocumentReference.prototype, "set")),
)
Reflect.set(DocumentSnapshot, "fromObject", patchFireStoreArrogance(Reflect.get(DocumentSnapshot, "fromObject")))
function mapValuesDeep(v, fn) {
	if (_.isPlainObject(v)) {
		return _.mapValues(v, (i) => mapValuesDeep(i, fn))
	} else if (_.isArray(v)) {
		return v.map((i) => mapValuesDeep(i, fn))
	} else {
		return fn(v)
	}
}
export async function fromFirestore(id, overrideCollection) {
	const collection = overrideCollection || this.collectionName
	if (!collection) {
		throw new Error(`Missing collection name to construct ${this.name}`)
	}
	const ref = this.DB.collection(overrideCollection || this.collectionName).doc(id)
	const ptr = await ref.get()
	if (!ptr.exists) {
		return undefined
	}
	const doc = this.from(
		// Fixes non-native firebase types
		mapValuesDeep(ptr.data(), (i) => {
			if (i instanceof Timestamp) {
				return i.toDate()
			}
			return i
		}),
	)
	Object.defineProperty(doc, "_ref", { value: ref, enumerable: false })
	Object.defineProperty(doc, "_id", { value: ptr.id, enumerable: true })
	return doc
}
export async function fromFirestoreQuery(query) {
	const ptr = await query.get()
	if (ptr.docs.length) {
		return ptr.docs.map((doc) => {
			const r = this.from(
				mapValuesDeep(doc.data(), (i) => {
					if (i instanceof Timestamp) {
						return i.toDate()
					}
					return i
				}),
			)
			Object.defineProperty(r, "_ref", { value: doc.ref, enumerable: false })
			Object.defineProperty(r, "_id", { value: doc.id, enumerable: true })
			return r
		})
	}
	return []
}
export async function setToFirestore(doc, overrideCollection, setOptions) {
	let ref = doc._ref
	if (!ref) {
		const collection = overrideCollection || this.collectionName
		if (!collection) {
			throw new Error(`Missing collection name to construct ${this.name}`)
		}
		const predefinedId = doc._id || undefined
		const hdl = this.DB.collection(overrideCollection || this.collectionName)
		ref = predefinedId ? hdl.doc(predefinedId) : hdl.doc()
		Object.defineProperty(doc, "_ref", { value: ref, enumerable: false })
		Object.defineProperty(doc, "_id", { value: ref.id, enumerable: true })
	}
	await ref.set(doc, { merge: true, ...setOptions })
	return doc
}
export async function deleteQueryBatch(query) {
	const snapshot = await query.get()
	const batchSize = snapshot.size
	if (batchSize === 0) {
		return
	}
	// Delete documents in a batch
	const batch = this.DB.batch()
	snapshot.docs.forEach((doc) => {
		batch.delete(doc.ref)
	})
	await batch.commit()
	process.nextTick(() => {
		this.deleteQueryBatch(query)
	})
}
export function fromFirestoreDoc(snapshot) {
	const doc = this.from(
		// Fixes non-native firebase types
		mapValuesDeep(snapshot.data(), (i) => {
			if (i instanceof Timestamp) {
				return i.toDate()
			}
			return i
		}),
	)
	Object.defineProperty(doc, "_ref", { value: snapshot.ref, enumerable: false })
	Object.defineProperty(doc, "_id", { value: snapshot.id, enumerable: true })
	return doc
}
const defaultFireStore = new Firestore({
	projectId: process.env.GCLOUD_PROJECT,
})
export class FirestoreRecord extends AutoCastable {
	static collectionName
	static OPS = FieldValue
	static DB = defaultFireStore
	static get COLLECTION() {
		if (!this.collectionName) {
			throw new Error("Not implemented")
		}
		return this.DB.collection(this.collectionName)
	}
	_id
	_ref
	static fromFirestore = fromFirestore
	static fromFirestoreDoc = fromFirestoreDoc
	static fromFirestoreQuery = fromFirestoreQuery
	static save = setToFirestore
	static deleteQueryBatch = deleteQueryBatch;
	[RPC_MARSHAL]() {
		return {
			...this,
			_id: this._id,
			_ref: this._ref?.path,
		}
	}
	degradeForFireStore() {
		return JSON.parse(
			JSON.stringify(this, function (k, v) {
				if (k === "") {
					return v
				}
				if (typeof v === "object" && v && typeof v.degradeForFireStore === "function") {
					return v.degradeForFireStore()
				}
				return v
			}),
		)
	}
}
__decorate([Prop()], FirestoreRecord.prototype, "_id", void 0)
//# sourceMappingURL=firestore.js.map
