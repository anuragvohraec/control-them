# Control them
Contains two modules:
1. ControlThem : For controlling what methods are allowed , what query params and data size limit is allowed for a url.
2. SignMeUpEngine: for JWT sign up process.

# Version
## 2.0.3
1. Bug fix: Correct Control request , its an extension of express Request Object

## 2.0.2
1. Bug fix: Control request header field was not capturing combines headers values

## 2.0.0
1. Added facility to add extra headers when auth token is delivered to user. This is used to send any more custom tokens to user.
2. Removed UID concept and left it to user