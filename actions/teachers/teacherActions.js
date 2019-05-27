const {Teachers, Departments, Users} = require('../../models')
const {validateQueryArgs} = require('../../helpers/validators/getQueryValidators')
const {sendMail} = require('../../helpers/mail')
const {convertMdToHtml} = require('../../helpers/markdown')
const {signJwt} = require('../../helpers/bcrypt')
const {isString, removeRedundant, isObjectId} = require('../../helpers/validators/typeValidators')
const {uploadImgur} = require('../../helpers/imgur')

const _validateArgs = (args) => {
    const {page, limit} = validateQueryArgs(args)
    const name = isString(args.name)
    const email = isString(args.email)
    const vnuEmail = isString(args.vnuEmail)
    const phone = isString(args.phone)
    const address = isString(args.address)
    const website = isString(args.website)
    const degree = isString(args.degree)
    const position = isString(args.position)

    return removeRedundant({page, address, limit, name, email, vnuEmail, phone, website, degree, position})
}

const _validateNewTeacherArgs = (args) => {
    const username = isString(args.username)
    const name = isString(args.name)
    const email = isString(args.email)
    const vnuEmail = isString(args.vnuEmail)
    const phone = isString(args.phone)
    const address = isString(args.address)
    const website = isString(args.website)
    const degree = isString(args.degree)
    const position = isString(args.position)
    const department = isObjectId(args.department)
    const field = isObjectId(args.field)

    console.log(username, name, email)
    if (!username || !name || !email) throw new Error('Missing params')
    return removeRedundant({username, address, department, name, email, vnuEmail, phone, website, degree, position})
}

exports.getOneTeacher = async (id) => {
    let data = new Promise(resolve => {
        Teachers.findOne({
            _id: id.toString()
        }, function(err, res) {
            resolve(res)
        })
    })
    return data
}

exports.editProfile = async (data) => {
    const {id} = data
    const teacher = await Teachers.findOne({
        _id: id.toString()
    })
    if (!teacher) throw new Error('Teacher not found')
    await teacher.delete()
    const newTeacher = new Teachers({_id:id, ...data})
    return await newTeacher.save()
}

exports.getTeachers = async (args) => {
    const validatedArgs = _validateArgs(args)
    const {limit, page, ...query} = validatedArgs

    const getQuery = Object.keys(query).reduce((q, key) => ({
        ...q,
        [key]: {$regex: new RegExp(`${query[key].toLowerCase()}`, 'i')}
    }), {})
    const skip = (page - 1) * limit

    const teacherQuery = Teachers
        .find(getQuery)
        .skip(skip)
        .limit(limit)
        .populate({
            path: 'department',
            model: Departments,
            select: '_id name'
        })
        .lean()
    const totalQuery = Teachers.countDocuments({})
    const [teachers, total] = await Promise.all([teacherQuery, totalQuery])

    return {
        total,
        teachers,
        page,
    }
}

exports.addTeacher = async (args) => {
    const validatedTeacher = _validateNewTeacherArgs(args)

    const existUser = await Users.findOne({
        $or: [
            {username: validatedTeacher.username},
            {email: validatedTeacher.email}
        ]
    })

    if (existUser) throw new Error('Username existed')

    const newUser = new Users({
        username: validatedTeacher.username,
        status: 'inactive',
        type: 'teacher',
        email: validatedTeacher.email
    })
    const user = await newUser.save()

    const newTeacher = new Teachers({...validatedTeacher, user: user._id})
    const token = signJwt({
        username: validatedTeacher.username
    })
    const teacher = await newTeacher.save()
    const title = 'u-Faculties registration'
    const body = `Your change password token: ${token}`
    const mail = await sendMail({receiver: validatedTeacher.email, title, body: convertMdToHtml(body)})

    return {user, teacher, mail}
}

exports.editTeacher = async (data) => {
    // const validatedArgs = _validateNewTeacherArgs(args)
    // const {id, ...teacherDetails} = validatedArgs
    const {} = data
    const teacher = await Teachers.findOne({
        _id: id
    }).select('_id')
    if (!teacher) throw new Error('Teacher not found')
    for (let key in teacherDetails) teacher[key] = teacherDetails[key]
    //add teacher id to field
    const field = await Fields.findOne({
        _id: args.field
    }).select('_id')
    if (!field) throw new Error('Field not found')
    field.teacher.append(id)
    return await teacher.save()
}

exports.deleteTeacher = async (id) => {
    const ID = isString(id)
    const teacher = await Teachers.findOne({
        _id: id
    }).select('_id')
    if (!teacher) throw new Error('Teacher not found')
    return await teacher.delete()
}

exports.uploadAvatar = async (file, _id) => {
    const teacher = await Teachers.findOne({
        _id,
    })
    if (!teacher) throw new Error('Teacher not found')

    const avatar = await uploadImgur(file.path)
    teacher.avatar = avatar
    return await teacher.save()
}